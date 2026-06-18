-- Add client assignment and shipment type to procurement requests
ALTER TABLE procurement_requests
  ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN shipment_type shipment_type NOT NULL DEFAULT 'client_owned';
