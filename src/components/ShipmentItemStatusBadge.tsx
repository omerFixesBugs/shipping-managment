import { cn } from '@/lib/utils'
import { SHIPMENT_ITEM_STATUS_LABELS } from '@/lib/constants'
import type { ShipmentItemStatus } from '@/types/database'

const STATUS_COLORS: Partial<Record<ShipmentItemStatus, string>> = {
  awaiting_receipt: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  received_at_bd: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  in_bd_storage: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  ready_for_pickup: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  out_for_delivery: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  missing: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  in_transit: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
}

export function ShipmentItemStatusBadge({ status }: { status: ShipmentItemStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {SHIPMENT_ITEM_STATUS_LABELS[status]}
    </span>
  )
}
