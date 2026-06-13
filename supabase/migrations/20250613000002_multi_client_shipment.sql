-- A shipment can carry products for multiple clients.
-- Client is now optional at shipment level; tracked per product instead.
ALTER TABLE shipments ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE shipment_items
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_items_client ON shipment_items(client_id);

-- Clients can read shipment items assigned to them (by product client_id)
CREATE POLICY "Clients read own items by client"
  ON shipment_items FOR SELECT USING (
    get_user_role() = 'client'
    AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

-- Clients can read shipments that contain at least one product assigned to them
CREATE POLICY "Clients read shipments via items"
  ON shipments FOR SELECT USING (
    get_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM shipment_items si
      WHERE si.shipment_id = shipments.id
      AND si.client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
  );
