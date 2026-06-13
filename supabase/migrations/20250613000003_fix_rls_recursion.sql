-- Fix infinite recursion: shipments policy referenced shipment_items,
-- whose policies reference shipments. Break loop with SECURITY DEFINER fn
-- (bypasses RLS inside the check).

DROP POLICY IF EXISTS "Clients read shipments via items" ON shipments;

CREATE OR REPLACE FUNCTION is_client_shipment(sid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM shipment_items si
    WHERE si.shipment_id = sid
    AND si.client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Clients read shipments via items"
  ON shipments FOR SELECT USING (
    get_user_role() = 'client' AND is_client_shipment(id)
  );
