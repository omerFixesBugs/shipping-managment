-- Shipment route, schedule, container, and capacity limits
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS destination_hub hub_type,
  ADD COLUMN IF NOT EXISTS ship_date DATE,
  ADD COLUMN IF NOT EXISTS container_name TEXT,
  ADD COLUMN IF NOT EXISTS volume_cbm NUMERIC(10, 3),
  ADD COLUMN IF NOT EXISTS max_item_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'sea';

-- weight_kg on shipments = max container weight capacity (kg)

-- Per-product weight/volume for storage and shipment line items
ALTER TABLE warehouse_inventory
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS volume_cbm NUMERIC(10, 3);

ALTER TABLE shipment_items
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS volume_cbm NUMERIC(10, 3);
