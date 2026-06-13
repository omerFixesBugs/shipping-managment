-- Enums
CREATE TYPE user_role AS ENUM ('owner', 'warehouse_manager', 'client');
CREATE TYPE hub_type AS ENUM ('dubai', 'china', 'bangladesh');
CREATE TYPE procurement_status AS ENUM (
  'draft', 'sent', 'quoted', 'approved', 'rejected', 'purchasing', 'ready_to_ship'
);
CREATE TYPE quote_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE shipment_type AS ENUM ('client_owned', 'business_sourced');
CREATE TYPE shipment_status AS ENUM (
  'received_at_origin',
  'preparing_export',
  'in_transit_to_bangladesh',
  'arrived_bangladesh',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered'
);
CREATE TYPE financial_category AS ENUM (
  'purchase_cost', 'shipping_cost', 'customs_fee', 'client_charge', 'other'
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  hub hub_type,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles
  ADD CONSTRAINT profiles_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- Procurement requests
CREATE TABLE procurement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  target_hub hub_type NOT NULL,
  status procurement_status NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT procurement_target_hub_check
    CHECK (target_hub IN ('dubai', 'china'))
);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  total_cost NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  breakdown JSONB DEFAULT '[]',
  notes TEXT,
  status quote_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shipments
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE DEFAULT '',
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  type shipment_type NOT NULL DEFAULT 'client_owned',
  origin_hub hub_type NOT NULL,
  current_hub hub_type NOT NULL,
  status shipment_status NOT NULL DEFAULT 'received_at_origin',
  description TEXT,
  weight_kg NUMERIC(10, 2),
  procurement_request_id UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipment_origin_hub_check
    CHECK (origin_hub IN ('dubai', 'china'))
);

-- Shipment events (audit trail)
CREATE TABLE shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  from_status shipment_status,
  to_status shipment_status NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial entries
CREATE TABLE financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  category financial_category NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SMS log
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  twilio_sid TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_hub ON profiles(hub);
CREATE INDEX idx_procurement_status ON procurement_requests(status);
CREATE INDEX idx_procurement_target_hub ON procurement_requests(target_hub);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_client ON shipments(client_id);
CREATE INDEX idx_shipments_current_hub ON shipments(current_hub);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_financial_entries_shipment ON financial_entries(shipment_id);

-- P&L view
CREATE VIEW shipment_pnl AS
SELECT
  s.id AS shipment_id,
  s.reference_code,
  s.client_id,
  s.type,
  s.origin_hub,
  s.status,
  COALESCE(SUM(CASE WHEN fe.category = 'client_charge' THEN fe.amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN fe.category != 'client_charge' THEN fe.amount ELSE 0 END), 0) AS costs,
  COALESCE(SUM(CASE WHEN fe.category = 'client_charge' THEN fe.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN fe.category != 'client_charge' THEN fe.amount ELSE 0 END), 0) AS profit
FROM shipments s
LEFT JOIN financial_entries fe ON fe.shipment_id = s.id
GROUP BY s.id, s.reference_code, s.client_id, s.type, s.origin_hub, s.status;

ALTER VIEW shipment_pnl SET (security_invoker = on);
GRANT SELECT ON shipment_pnl TO authenticated;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER procurement_requests_updated_at BEFORE UPDATE ON procurement_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Reference code generator
CREATE OR REPLACE FUNCTION generate_shipment_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_code IS NULL OR NEW.reference_code = '' THEN
    NEW.reference_code := 'SHP-' || UPPER(SUBSTRING(NEW.id::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipment_reference_code
  BEFORE INSERT ON shipments
  FOR EACH ROW EXECUTE FUNCTION generate_shipment_reference();

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_hub()
RETURNS hub_type AS $$
  SELECT hub FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Owner can read all profiles"
  ON profiles FOR SELECT USING (get_user_role() = 'owner');
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Owner can update all profiles"
  ON profiles FOR UPDATE USING (get_user_role() = 'owner');

-- Clients policies
CREATE POLICY "Owner full access clients"
  ON clients FOR ALL USING (get_user_role() = 'owner');
CREATE POLICY "Warehouse managers read clients"
  ON clients FOR SELECT USING (get_user_role() = 'warehouse_manager');
CREATE POLICY "Clients read own record"
  ON clients FOR SELECT USING (
    get_user_role() = 'client' AND id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

-- Procurement policies
CREATE POLICY "Owner full access procurement"
  ON procurement_requests FOR ALL USING (get_user_role() = 'owner');
CREATE POLICY "Managers read hub procurement"
  ON procurement_requests FOR SELECT USING (
    get_user_role() = 'warehouse_manager' AND target_hub = get_user_hub()
  );
CREATE POLICY "Managers update hub procurement"
  ON procurement_requests FOR UPDATE USING (
    get_user_role() = 'warehouse_manager' AND target_hub = get_user_hub()
  );

-- Quotes policies
CREATE POLICY "Owner full access quotes"
  ON quotes FOR ALL USING (get_user_role() = 'owner');
CREATE POLICY "Managers manage hub quotes"
  ON quotes FOR ALL USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM procurement_requests pr
      WHERE pr.id = request_id AND pr.target_hub = get_user_hub()
    )
  );

-- Shipments policies
CREATE POLICY "Owner full access shipments"
  ON shipments FOR ALL USING (get_user_role() = 'owner');
CREATE POLICY "Managers read hub shipments"
  ON shipments FOR SELECT USING (
    get_user_role() = 'warehouse_manager'
    AND (origin_hub = get_user_hub() OR current_hub = get_user_hub())
  );
CREATE POLICY "Managers update hub shipments"
  ON shipments FOR UPDATE USING (
    get_user_role() = 'warehouse_manager'
    AND (origin_hub = get_user_hub() OR current_hub = get_user_hub())
  );
CREATE POLICY "Managers insert shipments"
  ON shipments FOR INSERT WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND origin_hub = get_user_hub()
  );
CREATE POLICY "Clients read own shipments"
  ON shipments FOR SELECT USING (
    get_user_role() = 'client'
    AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

-- Shipment events policies
CREATE POLICY "Owner full access events"
  ON shipment_events FOR ALL USING (get_user_role() = 'owner');
CREATE POLICY "Managers read hub events"
  ON shipment_events FOR SELECT USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND (s.origin_hub = get_user_hub() OR s.current_hub = get_user_hub())
    )
  );
CREATE POLICY "Managers insert hub events"
  ON shipment_events FOR INSERT WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND (s.origin_hub = get_user_hub() OR s.current_hub = get_user_hub())
    )
  );
CREATE POLICY "Clients read own shipment events"
  ON shipment_events FOR SELECT USING (
    get_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND s.client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Financial entries policies
CREATE POLICY "Owner full access financial"
  ON financial_entries FOR ALL USING (get_user_role() = 'owner');

-- Notifications policies
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- SMS logs - owner only
CREATE POLICY "Owner read sms logs"
  ON sms_logs FOR SELECT USING (get_user_role() = 'owner');

-- Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
