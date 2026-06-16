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
export type InventoryStatus = 'in_storage' | 'shipped'
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
  requested_by: string | null
  created_at: string
  updated_at: string
  quotes?: Quote[]
  clients?: { name: string } | null
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
  added_by: string | null
  created_at: string
  updated_at: string
  clients?: { name: string } | null
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
  created_by: string | null
  created_at: string
  updated_at: string
  clients?: { name: string } | null
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
  shipment_id: string
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
