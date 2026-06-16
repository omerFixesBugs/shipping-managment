-- Any warehouse manager (not just Bangladesh) can register clients.
DROP POLICY IF EXISTS "Warehouse managers insert clients" ON clients;
CREATE POLICY "Warehouse managers insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'warehouse_manager');

DROP POLICY IF EXISTS "Warehouse managers update clients" ON clients;
CREATE POLICY "Warehouse managers update clients"
  ON clients FOR UPDATE TO authenticated
  USING (get_user_role() = 'warehouse_manager');
