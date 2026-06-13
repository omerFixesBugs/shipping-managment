import type { HubType, ProcurementStatus, ShipmentStatus, UserRole } from '@/types/database'

export const HUB_LABELS: Record<HubType, string> = {
  dubai: 'Dubai',
  china: 'China',
  bangladesh: 'Bangladesh',
}

export interface HubTheme {
  label: string
  accent: string
  accentForeground: string
  accentSoft: string
}

/**
 * Distinct accent palette per hub / role so each logged-in workspace
 * feels visually different at a glance.
 */
export const HUB_THEMES: Record<HubType, HubTheme> = {
  dubai: { label: 'Dubai Hub', accent: '#f59e0b', accentForeground: '#ffffff', accentSoft: 'rgba(245, 158, 11, 0.14)' },
  china: { label: 'China Hub', accent: '#ef4444', accentForeground: '#ffffff', accentSoft: 'rgba(239, 68, 68, 0.14)' },
  bangladesh: { label: 'Bangladesh Hub', accent: '#10b981', accentForeground: '#ffffff', accentSoft: 'rgba(16, 185, 129, 0.14)' },
}

export const ROLE_THEMES: Record<Exclude<UserRole, 'warehouse_manager'>, HubTheme> = {
  owner: { label: 'Head Office', accent: '#6366f1', accentForeground: '#ffffff', accentSoft: 'rgba(99, 102, 241, 0.14)' },
  client: { label: 'Client Portal', accent: '#0ea5e9', accentForeground: '#ffffff', accentSoft: 'rgba(14, 165, 233, 0.14)' },
}

export function getWorkspaceTheme(role: UserRole | undefined, hub: HubType | null | undefined): HubTheme {
  if (role === 'warehouse_manager' && hub) return HUB_THEMES[hub]
  if (role === 'owner') return ROLE_THEMES.owner
  if (role === 'client') return ROLE_THEMES.client
  return ROLE_THEMES.owner
}

export const PROCUREMENT_STATUS_LABELS: Record<ProcurementStatus, string> = {
  draft: 'Draft',
  sent: 'Sent to Hub',
  quoted: 'Quote Received',
  approved: 'Approved',
  rejected: 'Rejected',
  purchasing: 'Purchasing',
  ready_to_ship: 'Ready to Ship',
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  received_at_origin: 'Received at Origin',
  preparing_export: 'Preparing Export',
  in_transit_to_bangladesh: 'Shipped · In Transit to Bangladesh',
  arrived_bangladesh: 'Arrived in Bangladesh',
  ready_for_pickup: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
}

export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
  'received_at_origin',
  'preparing_export',
  'in_transit_to_bangladesh',
  'arrived_bangladesh',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
]

export const ORIGIN_HUBS: HubType[] = ['dubai', 'china']

export const FINANCIAL_CATEGORY_LABELS = {
  purchase_cost: 'Purchase Cost',
  shipping_cost: 'Shipping Cost',
  customs_fee: 'Customs Fee',
  client_charge: 'Client Charge (Revenue)',
  other: 'Other',
} as const

export const PROCUREMENT_TRANSITIONS: Record<ProcurementStatus, ProcurementStatus[]> = {
  draft: ['sent'],
  sent: ['quoted'],
  quoted: ['approved', 'rejected'],
  approved: ['purchasing'],
  rejected: [],
  purchasing: ['ready_to_ship'],
  ready_to_ship: [],
}

export function getNextShipmentStatuses(
  current: ShipmentStatus,
  hub: HubType | null
): ShipmentStatus[] {
  const idx = SHIPMENT_STATUS_ORDER.indexOf(current)
  if (idx < 0 || idx >= SHIPMENT_STATUS_ORDER.length - 1) return []

  const next = SHIPMENT_STATUS_ORDER[idx + 1]

  if (current === 'preparing_export' && next === 'in_transit_to_bangladesh') {
    return hub === 'dubai' || hub === 'china' ? [next] : []
  }
  if (current === 'in_transit_to_bangladesh' && next === 'arrived_bangladesh') {
    return hub === 'bangladesh' ? [next] : []
  }
  if (
    ['arrived_bangladesh', 'ready_for_pickup', 'out_for_delivery'].includes(current) &&
    hub === 'bangladesh'
  ) {
    if (current === 'arrived_bangladesh') return ['ready_for_pickup', 'out_for_delivery']
    if (current === 'ready_for_pickup') return ['delivered']
    if (current === 'out_for_delivery') return ['delivered']
  }
  if (hub === 'dubai' || hub === 'china') {
    if (current === 'received_at_origin') return ['preparing_export']
    if (current === 'preparing_export') return ['in_transit_to_bangladesh']
  }
  return []
}
