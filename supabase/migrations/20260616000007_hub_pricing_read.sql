-- Hub managers can read product_pricing (incl. purchase_cost) for requests at their hub
CREATE POLICY "Hub managers read hub product pricing"
  ON product_pricing FOR SELECT
  USING (
    get_user_role() = 'warehouse_manager'
    AND EXISTS (
      SELECT 1 FROM procurement_requests pr
      WHERE pr.id = product_pricing.request_id
      AND pr.target_hub = get_user_hub()
    )
  );
