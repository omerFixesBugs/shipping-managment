-- Per-product BD fulfillment: receive → storage → ready → delivered → payment

DO $$ BEGIN
  CREATE TYPE shipment_item_status AS ENUM (
    'in_transit',
    'awaiting_receipt',
    'received_at_bd',
    'in_bd_storage',
    'ready_for_pickup',
    'out_for_delivery',
    'delivered',
    'missing'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE shipment_items
  ADD COLUMN IF NOT EXISTS status shipment_item_status NOT NULL DEFAULT 'in_transit',
  ADD COLUMN IF NOT EXISTS product_pricing_id UUID REFERENCES product_pricing(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bd_inventory_id UUID,
  ADD COLUMN IF NOT EXISTS received_at_bd TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_type TEXT CHECK (delivery_type IS NULL OR delivery_type IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES client_settlements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marked_missing_at TIMESTAMPTZ;

ALTER TABLE client_settlements
  ADD COLUMN IF NOT EXISTS shipment_item_id UUID REFERENCES shipment_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_items_status ON shipment_items(shipment_id, status);
CREATE INDEX IF NOT EXISTS idx_shipment_items_pricing ON shipment_items(product_pricing_id);

-- Bangladesh hub can hold received cargo in storage
ALTER TABLE warehouse_inventory DROP CONSTRAINT IF EXISTS inventory_hub_check;
ALTER TABLE warehouse_inventory
  ADD CONSTRAINT inventory_hub_check CHECK (hub IN ('dubai', 'china', 'bangladesh'));

ALTER TABLE warehouse_inventory
  ADD COLUMN IF NOT EXISTS shipment_item_id UUID REFERENCES shipment_items(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'delivered';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- BD managers update item fulfillment when cargo is at Bangladesh
CREATE POLICY "BD managers update item fulfillment"
  ON shipment_items FOR UPDATE
  USING (
    get_user_role() = 'warehouse_manager'
    AND get_user_hub() = 'bangladesh'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND s.current_hub = 'bangladesh'
      AND s.status IN (
        'in_transit_to_bangladesh',
        'arrived_bangladesh',
        'ready_for_pickup',
        'out_for_delivery',
        'delivered'
      )
    )
  );

CREATE POLICY "BD managers insert bd inventory"
  ON warehouse_inventory FOR INSERT
  WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND get_user_hub() = 'bangladesh'
    AND hub = 'bangladesh'
  );

CREATE POLICY "BD managers update bd inventory"
  ON warehouse_inventory FOR UPDATE
  USING (
    get_user_role() = 'warehouse_manager'
    AND get_user_hub() = 'bangladesh'
    AND hub = 'bangladesh'
  );

-- BD-safe view: items ready for collection (delivered flow)
CREATE OR REPLACE VIEW bd_collectible_items AS
SELECT
  si.id AS shipment_item_id,
  si.shipment_id,
  si.name AS product_name,
  si.quantity,
  si.unit,
  si.weight_kg,
  si.status AS item_status,
  si.client_id,
  si.delivery_type,
  si.product_pricing_id,
  si.received_at_bd,
  si.ready_at,
  s.reference_code AS shipment_reference,
  c.name AS client_name,
  pp.client_price,
  pp.advance_amount,
  pp.currency,
  pp.request_id
FROM shipment_items si
JOIN shipments s ON s.id = si.shipment_id
LEFT JOIN clients c ON c.id = si.client_id
LEFT JOIN product_pricing pp ON pp.id = si.product_pricing_id
WHERE si.status IN ('in_bd_storage', 'ready_for_pickup', 'out_for_delivery')
  AND si.settlement_id IS NULL;

ALTER VIEW bd_collectible_items SET (security_invoker = false);
GRANT SELECT ON bd_collectible_items TO authenticated;

-- Backfill: items on in-transit shipments
UPDATE shipment_items si
SET status = 'in_transit'
FROM shipments s
WHERE s.id = si.shipment_id
  AND s.status = 'in_transit_to_bangladesh'
  AND si.status = 'in_transit';

UPDATE shipment_items si
SET status = 'awaiting_receipt'
FROM shipments s
WHERE s.id = si.shipment_id
  AND s.status IN ('arrived_bangladesh', 'ready_for_pickup', 'out_for_delivery')
  AND si.status = 'in_transit';
