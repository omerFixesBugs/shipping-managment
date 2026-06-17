-- Procurement modes, per-product pricing (owner margin hidden from BD), and client settlements

CREATE TYPE procurement_request_mode AS ENUM ('sourced', 'direct_buy');

ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS request_mode procurement_request_mode NOT NULL DEFAULT 'sourced';

-- Per-product pricing: owner sees purchase + sell; BD sees client price only (via view)
CREATE TABLE product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
  item_index INT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  purchase_cost NUMERIC(12, 2),
  client_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, item_index)
);

CREATE INDEX idx_product_pricing_request ON product_pricing(request_id);
CREATE INDEX idx_product_pricing_client ON product_pricing(client_id);

-- BD records payment when client picks up or receives delivery
CREATE TABLE client_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_pricing_id UUID REFERENCES product_pricing(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES warehouse_inventory(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('pickup', 'delivery')),
  client_price NUMERIC(12, 2) NOT NULL,
  advance_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  extra_costs JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_settlements_client ON client_settlements(client_id);

-- Link financial entries to procurement products (shipment optional for product-level revenue)
ALTER TABLE financial_entries
  ALTER COLUMN shipment_id DROP NOT NULL;

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS procurement_request_id UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_pricing_id UUID REFERENCES product_pricing(id) ON DELETE SET NULL;

ALTER TYPE financial_category ADD VALUE IF NOT EXISTS 'advance_payment';
ALTER TYPE financial_category ADD VALUE IF NOT EXISTS 'product_revenue';
ALTER TYPE financial_category ADD VALUE IF NOT EXISTS 'packaging_cost';
ALTER TYPE financial_category ADD VALUE IF NOT EXISTS 'product_purchase';

-- BD-safe view: no purchase_cost / margin (runs as definer so BD never reads base table)
CREATE VIEW bd_product_pricing AS
SELECT
  id,
  request_id,
  item_index,
  client_id,
  product_name,
  client_price,
  advance_amount,
  currency,
  created_at,
  updated_at
FROM product_pricing;

ALTER VIEW bd_product_pricing SET (security_invoker = false);
GRANT SELECT ON bd_product_pricing TO authenticated;

-- Owner product-level P&L
CREATE VIEW product_pnl AS
SELECT
  pp.id AS pricing_id,
  pp.request_id,
  pp.item_index,
  pp.client_id,
  c.name AS client_name,
  pp.product_name,
  pr.title AS request_title,
  pr.request_mode,
  pr.status AS request_status,
  pp.purchase_cost,
  pp.client_price,
  pp.advance_amount,
  (pp.client_price - COALESCE(pp.purchase_cost, 0)) AS margin,
  pp.currency,
  COALESCE(cs.total_collected, 0) AS collected,
  COALESCE(cs.total_due, 0) AS outstanding
FROM product_pricing pp
JOIN procurement_requests pr ON pr.id = pp.request_id
LEFT JOIN clients c ON c.id = pp.client_id
LEFT JOIN LATERAL (
  SELECT
    SUM(amount_paid) AS total_collected,
    SUM(due_amount) AS total_due
  FROM client_settlements cs
  WHERE cs.product_pricing_id = pp.id
) cs ON true;

ALTER VIEW product_pnl SET (security_invoker = on);
GRANT SELECT ON product_pnl TO authenticated;

CREATE TRIGGER product_pricing_updated_at
  BEFORE UPDATE ON product_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_settlements ENABLE ROW LEVEL SECURITY;

-- Owner full access to pricing
CREATE POLICY "Owner full access product_pricing"
  ON product_pricing FOR ALL
  USING (get_user_role() = 'owner');

CREATE POLICY "Owner insert pricing"
  ON product_pricing FOR INSERT
  WITH CHECK (get_user_role() = 'owner');

-- Settlements: owner sees all; BD (bangladesh) can read/write
CREATE POLICY "Owner full access settlements"
  ON client_settlements FOR ALL
  USING (get_user_role() = 'owner');

CREATE POLICY "BD manage settlements"
  ON client_settlements FOR ALL
  USING (
    get_user_role() = 'warehouse_manager'
    AND get_user_hub() = 'bangladesh'
  );
