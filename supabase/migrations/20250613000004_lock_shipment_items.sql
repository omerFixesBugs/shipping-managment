-- Enforce item-edit rules server-side: only the ORIGIN hub manager,
-- and only before the shipment leaves origin (received_at_origin / preparing_export).
-- Owner keeps full access (separate policy). Read stays broad (origin or current).

DROP POLICY IF EXISTS "Managers write hub shipment items" ON shipment_items;
DROP POLICY IF EXISTS "Managers update hub shipment items" ON shipment_items;
DROP POLICY IF EXISTS "Managers delete hub shipment items" ON shipment_items;

CREATE POLICY "Managers write origin shipment items"
  ON shipment_items FOR INSERT TO authenticated WITH CHECK (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND s.origin_hub = get_user_hub()
      AND s.status IN ('received_at_origin', 'preparing_export')
    )
  );

CREATE POLICY "Managers update origin shipment items"
  ON shipment_items FOR UPDATE USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND s.origin_hub = get_user_hub()
      AND s.status IN ('received_at_origin', 'preparing_export')
    )
  );

CREATE POLICY "Managers delete origin shipment items"
  ON shipment_items FOR DELETE USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id
      AND s.origin_hub = get_user_hub()
      AND s.status IN ('received_at_origin', 'preparing_export')
    )
  );
