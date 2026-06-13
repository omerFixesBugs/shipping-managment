-- Products carried inside a shipment. A shipment can hold many products.
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  notes TEXT,
  source_url TEXT,
  images JSONB NOT NULL DEFAULT '[]',
  procurement_request_id UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);

CREATE TRIGGER shipment_items_updated_at BEFORE UPDATE ON shipment_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Owner: full access
CREATE POLICY "Owner full access shipment items"
  ON shipment_items FOR ALL USING (get_user_role() = 'owner');

-- Warehouse managers: manage items for shipments at their hub (origin or current)
CREATE POLICY "Managers read hub shipment items"
  ON shipment_items FOR SELECT USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND (s.origin_hub = get_user_hub() OR s.current_hub = get_user_hub())
    )
  );
CREATE POLICY "Managers write hub shipment items"
  ON shipment_items FOR INSERT TO authenticated WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND (s.origin_hub = get_user_hub() OR s.current_hub = get_user_hub())
    )
  );
CREATE POLICY "Managers update hub shipment items"
  ON shipment_items FOR UPDATE USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND (s.origin_hub = get_user_hub() OR s.current_hub = get_user_hub())
    )
  );
CREATE POLICY "Managers delete hub shipment items"
  ON shipment_items FOR DELETE USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND (s.origin_hub = get_user_hub() OR s.current_hub = get_user_hub())
    )
  );

-- Clients: read items of their own shipments
CREATE POLICY "Clients read own shipment items"
  ON shipment_items FOR SELECT USING (
    get_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND s.client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
  );
