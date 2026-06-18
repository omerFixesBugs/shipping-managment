import { cn } from '@/lib/utils'
import type { ProcurementStatus, ShipmentStatus } from '@/types/database'

interface StatusConfig {
  label: string
  dot: string
  className: string
}

const PROCUREMENT_CONFIG: Record<ProcurementStatus, StatusConfig> = {
  draft:         { label: 'Draft',           dot: '#94a3b8', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300' },
  sent:          { label: 'Sent to Hub',     dot: '#3b82f6', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  quoted:        { label: 'Quote Received',  dot: '#f59e0b', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  approved:      { label: 'Approved',        dot: '#10b981', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  rejected:      { label: 'Rejected',        dot: '#ef4444', className: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  purchasing:    { label: 'Purchasing',      dot: '#8b5cf6', className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
  ready_to_ship: { label: 'Ready to Ship',   dot: '#10b981', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
}

const SHIPMENT_CONFIG: Record<ShipmentStatus, StatusConfig> = {
  received_at_origin:        { label: 'Received at Origin',    dot: '#94a3b8', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300' },
  preparing_export:          { label: 'Preparing Export',      dot: '#3b82f6', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  in_transit_to_bangladesh:  { label: 'In Transit',            dot: '#f59e0b', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  arrived_bangladesh:        { label: 'Arrived · Bangladesh',  dot: '#f59e0b', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  ready_for_pickup:          { label: 'Ready for Pickup',      dot: '#10b981', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  out_for_delivery:          { label: 'Out for Delivery',      dot: '#8b5cf6', className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
  delivered:                 { label: 'Delivered',             dot: '#10b981', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' },
}

function StatusPill({ config }: { config: StatusConfig }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', config.className)}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  )
}

export function ProcurementStatusBadge({ status }: { status: ProcurementStatus }) {
  return <StatusPill config={PROCUREMENT_CONFIG[status]} />
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <StatusPill config={SHIPMENT_CONFIG[status]} />
}
