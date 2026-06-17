export type UserRole = 'owner' | 'warehouse_manager' | 'client'
export type HubType = 'dubai' | 'china' | 'bangladesh'
export type ProcurementStatus =
  | 'draft'
  | 'sent'
  | 'quoted'
  | 'approved'
  | 'rejected'
  | 'purchasing'
  | 'ready_to_ship'
export type QuoteStatus = 'pending' | 'accepted' | 'rejected'
export type ShipmentType = 'client_owned' | 'business_sourced'
export type ProcurementRequestMode = 'sourced' | 'direct_buy'
export type InventoryStatus = 'in_storage' | 'shipped' | 'delivered'
export type ShipmentItemStatus =
  | 'in_transit'
  | 'awaiting_receipt'
  | 'received_at_bd'
  | 'in_bd_storage'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'missing'
export type ShipmentStatus =
  | 'received_at_origin'
  | 'preparing_export'
  | 'in_transit_to_bangladesh'
  | 'arrived_bangladesh'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
export type FinancialCategory =
  | 'purchase_cost'
  | 'shipping_cost'
  | 'customs_fee'
  | 'client_charge'
  | 'other'
  | 'advance_payment'
  | 'product_revenue'
  | 'packaging_cost'
  | 'product_purchase'

export interface Profile {
  id: string
  role: UserRole
  hub: HubType | null
  full_name: string
  phone: string | null
  client_id: string | null
  position: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface ProcurementItem {
  name: string
  quantity: number
  unit?: string
  notes?: string
  /** Optional URL where the warehouse manager can find/buy this product online. */
  sourceUrl?: string
  /** Optional reference image URLs (stored in the `product-images` bucket). */
  images?: string[]
  /** Optional deadline by which client needs this product (ISO date string). */
  deadline?: string | null
  /** Owner's expected selling price for this product. */
  expectedSellingPrice?: number | null
}

export interface ProcurementRequest {
  id: string
  owner_id: string
  target_hub: HubType
  status: ProcurementStatus
  title: string
  items: ProcurementItem[]
  notes: string | null
  client_id: string | null
  shipment_type: ShipmentType
  request_mode: ProcurementRequestMode
  requested_by: string | null
  created_at: string
  updated_at: string
  quotes?: Quote[]
  clients?: { name: string } | null
}

export interface ProductPricing {
  id: string
  request_id: string
  item_index: number
  client_id: string | null
  product_name: string
  purchase_cost: number | null
  client_price: number
  advance_amount: number
  currency: string
  created_at: string
  updated_at: string
}

export interface BdProductPricing {
  id: string
  request_id: string
  item_index: number
  client_id: string | null
  product_name: string
  client_price: number
  advance_amount: number
  currency: string
}

export interface ClientSettlement {
  id: string
  client_id: string
  product_pricing_id: string | null
  inventory_id: string | null
  shipment_item_id: string | null
  product_name: string
  delivery_type: 'pickup' | 'delivery'
  client_price: number
  advance_applied: number
  amount_paid: number
  due_amount: number
  extra_costs: { label: string; amount: number }[]
  notes: string | null
  recorded_by: string | null
  settled_at: string
  created_at: string
  clients?: { name: string } | null
}

export interface ProductPnl {
  pricing_id: string
  request_id: string
  item_index: number
  client_id: string | null
  client_name: string | null
  product_name: string
  request_title: string
  request_mode: ProcurementRequestMode
  request_status: ProcurementStatus
  purchase_cost: number | null
  client_price: number
  advance_amount: number
  margin: number
  currency: string
  collected: number
  outstanding: number
}

export interface WarehouseInventory {
  id: string
  hub: HubType
  client_id: string | null
  name: string
  quantity: number
  unit: string | null
  weight_kg: number | null
  volume_cbm: number | null
  notes: string | null
  source_url: string | null
  images: string[]
  status: InventoryStatus
  shipment_id: string | null
  shipment_item_id: string | null
  added_by: string | null
  created_at: string
  updated_at: string
  clients?: { name: string } | null
  shipments?: { reference_code: string } | null
}

export interface Quote {
  id: string
  request_id: string
  manager_id: string
  total_cost: number
  currency: string
  breakdown: { item: string; cost: number }[]
  notes: string | null
  status: QuoteStatus
  created_at: string
  updated_at: string
}

export interface Shipment {
  id: string
  reference_code: string
  client_id: string | null
  type: ShipmentType
  origin_hub: HubType
  destination_hub: HubType | null
  current_hub: HubType
  status: ShipmentStatus
  description: string | null
  weight_kg: number | null
  volume_cbm: number | null
  max_item_quantity: number | null
  ship_date: string | null
  container_name: string | null
  shipping_method: string | null
  procurement_request_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  clients?: Client
}

export interface ShipmentItem {
  id: string
  shipment_id: string
  name: string
  quantity: number
  unit: string | null
  weight_kg: number | null
  volume_cbm: number | null
  notes: string | null
  source_url: string | null
  images: string[]
  client_id: string | null
  procurement_request_id: string | null
  status: ShipmentItemStatus
  product_pricing_id: string | null
  bd_inventory_id: string | null
  received_at_bd: string | null
  ready_at: string | null
  delivered_at: string | null
  delivery_type: 'pickup' | 'delivery' | null
  settlement_id: string | null
  marked_missing_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  clients?: { name: string } | null
  shipments?: { reference_code: string } | null
  product_pricing?: BdProductPricing | null
}

export interface BdCollectibleItem {
  shipment_item_id: string
  shipment_id: string
  product_name: string
  quantity: number
  unit: string | null
  weight_kg: number | null
  item_status: ShipmentItemStatus
  client_id: string | null
  delivery_type: 'pickup' | 'delivery' | null
  product_pricing_id: string | null
  received_at_bd: string | null
  ready_at: string | null
  shipment_reference: string
  client_name: string | null
  client_price: number | null
  advance_amount: number | null
  currency: string | null
  request_id: string | null
}

export interface ShipmentEvent {
  id: string
  shipment_id: string
  from_status: ShipmentStatus | null
  to_status: ShipmentStatus
  actor_id: string | null
  notes: string | null
  created_at: string
}

export interface FinancialEntry {
  id: string
  shipment_id: string | null
  procurement_request_id: string | null
  product_pricing_id: string | null
  category: FinancialCategory
  amount: number
  currency: string
  description: string | null
  entry_date: string
  created_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

export interface ShipmentPnl {
  shipment_id: string
  reference_code: string
  client_id: string
  type: ShipmentType
  origin_hub: HubType
  status: ShipmentStatus
  revenue: number
  costs: number
  profit: number
}
