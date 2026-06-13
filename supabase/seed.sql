-- Demo seed data (run after creating users via Supabase Auth)
-- Update profile roles after signup:
--
-- UPDATE profiles SET role = 'owner', full_name = 'Business Owner', phone = '+971500000001' WHERE id = '<owner-uuid>';
-- UPDATE profiles SET role = 'warehouse_manager', hub = 'dubai', full_name = 'Dubai Manager', phone = '+971500000002' WHERE id = '<dubai-uuid>';
-- UPDATE profiles SET role = 'warehouse_manager', hub = 'china', full_name = 'China Manager', phone = '+8613800000001' WHERE id = '<china-uuid>';
-- UPDATE profiles SET role = 'warehouse_manager', hub = 'bangladesh', full_name = 'BD Manager', phone = '+8801700000001' WHERE id = '<bd-uuid>';

INSERT INTO clients (id, name, phone, email, address) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Rahim Trading', '+8801711111111', 'rahim@example.com', 'Dhaka, Bangladesh'),
  ('a0000000-0000-4000-8000-000000000002', 'Karim Imports', '+8801722222222', 'karim@example.com', 'Chittagong, Bangladesh')
ON CONFLICT DO NOTHING;
