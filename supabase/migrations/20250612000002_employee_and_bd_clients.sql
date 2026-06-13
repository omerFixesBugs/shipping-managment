-- Add position field to profiles for employee management
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS position TEXT;

-- Allow Bangladesh warehouse managers to insert clients
-- (so they can register clients on behalf of the owner)
CREATE POLICY "BD warehouse insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND get_user_hub() = 'bangladesh'
  );

-- Allow warehouse managers to update clients (useful for BD hub support)
CREATE POLICY "BD warehouse update clients"
  ON clients FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'warehouse_manager'
    AND get_user_hub() = 'bangladesh'
  );
