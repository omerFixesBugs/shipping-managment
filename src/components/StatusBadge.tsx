import { Badge } from '@/components/ui/badge'
import {
  PROCUREMENT_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
} from '@/lib/constants'
import type { ProcurementStatus, ShipmentStatus } from '@/types/database'

const procurementVariants: Record<ProcurementStatus, 'default' | 'secondary' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary',
  sent: 'default',
  quoted: 'warning',
  approved: 'success',
  rejected: 'destructive',
  purchasing: 'default',
  ready_to_ship: 'success',
}

const shipmentVariants: Record<ShipmentStatus, 'default' | 'secondary' | 'warning' | 'success'> = {
  received_at_origin: 'secondary',
  preparing_export: 'default',
  in_transit_to_bangladesh: 'warning',
  arrived_bangladesh: 'warning',
  ready_for_pickup: 'success',
  out_for_delivery: 'default',
  delivered: 'success',
}

export function ProcurementStatusBadge({ status }: { status: ProcurementStatus }) {
  return <Badge variant={procurementVariants[status]}>{PROCUREMENT_STATUS_LABELS[status]}</Badge>
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge variant={shipmentVariants[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>
}
