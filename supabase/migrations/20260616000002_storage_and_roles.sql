-- ── Procurement: track creator + let BD (bangladesh) managers raise requests ──

-- Who actually created the request (owner or BD admin). owner_id stays FK-valid.
ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- BD (bangladesh warehouse manager) can create procurement requests like the owner.
CREATE POLICY "BD insert procurement"
  ON procurement_requests FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND get_user_hub() = 'bangladesh'
  );

-- Creators (BD) can read/update the requests they raised, even though the
-- request targets dubai/china (the existing manager policy keys off target_hub).
CREATE POLICY "Creators read own procurement"
  ON procurement_requests FOR SELECT
  USING (requested_by = auth.uid());

CREATE POLICY "Creators update own procurement"
  ON procurement_requests FOR UPDATE
  USING (requested_by = auth.uid());

-- ── Warehouse inventory: products stored directly at a hub ──

DO $$ BEGIN
  CREATE TYPE inventory_status AS ENUM ('in_storage', 'shipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub hub_type NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  notes TEXT,
  source_url TEXT,
  images JSONB NOT NULL DEFAULT '[]',
  status inventory_status NOT NULL DEFAULT 'in_storage',
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_hub_check CHECK (hub IN ('dubai', 'china'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_hub ON warehouse_inventory(hub, status);
CREATE INDEX IF NOT EXISTS idx_inventory_client ON warehouse_inventory(client_id);

CREATE TRIGGER warehouse_inventory_updated_at BEFORE UPDATE ON warehouse_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE warehouse_inventory ENABLE ROW LEVEL SECURITY;

-- Owner: full access (includes delete).
CREATE POLICY "Owner full access inventory"
  ON warehouse_inventory FOR ALL USING (get_user_role() = 'owner');

-- Hub managers: manage stock for their own hub.
CREATE POLICY "Managers manage hub inventory"
  ON warehouse_inventory FOR ALL USING (
    get_user_role() = 'warehouse_manager'
    AND hub = get_user_hub()
  )
  WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND hub = get_user_hub()
  );

-- Clients: read their own stored products.
CREATE POLICY "Clients read own inventory"
  ON warehouse_inventory FOR SELECT USING (
    get_user_role() = 'client'
    AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );
