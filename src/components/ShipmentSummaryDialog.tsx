import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { ShipmentTimeline } from '@/components/ShipmentTimeline'
import { HUB_LABELS, SHIPMENT_STATUS_LABELS } from '@/lib/constants'
import { sumLineTotals } from '@/lib/shipmentCapacity'
import {
  formatShippingMethod,
  getEstimatedArrivalDate,
  getTransitDays,
} from '@/lib/shipmentSchedule'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { BoardShipment } from '@/components/ShipmentStatusBoard'
import type { ShipmentEvent } from '@/types/database'

type ShipmentSummaryDialogProps = {
  shipment: BoardShipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  manageHref: string
}

function CapacityBar({ label, used, max, unit }: { label: string; used: number; max: number | null; unit: string }) {
  if (max == null || max <= 0) return null
  const pct = Math.min(100, Math.round((used / max) * 100))
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-data font-medium">
          {used.toFixed(unit === 'pcs' ? 0 : unit === 'CBM' ? 3 : 1)} / {max} {unit}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--color-brand)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-medium">{value}</p>
    </div>
  )
}

export function ShipmentSummaryDialog({
  shipment,
  open,
  onOpenChange,
  manageHref,
}: ShipmentSummaryDialogProps) {
  const { data: events } = useQuery({
    queryKey: ['shipment-events', shipment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipment!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as ShipmentEvent[]
    },
    enabled: open && !!shipment?.id,
  })

  if (!shipment) return null

  const dest = shipment.destination_hub ?? 'bangladesh'
  const items = shipment.shipment_items ?? []
  const totals = sumLineTotals(items)
  const eta = getEstimatedArrivalDate(shipment.ship_date, shipment.shipping_method)
  const hasCapacity = shipment.weight_kg || shipment.volume_cbm || shipment.max_item_quantity

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-left font-data text-lg">{shipment.reference_code}</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {HUB_LABELS[shipment.origin_hub]} → {HUB_LABELS[dest]}
                {shipment.clients?.name ? ` · ${shipment.clients.name}` : ''}
              </p>
            </div>
            <ShipmentStatusBadge status={shipment.status} />
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="shrink-0 rounded-lg border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat
                  label="Method"
                  value={formatShippingMethod(shipment.shipping_method)}
                />
                <Stat
                  label="Sail Date"
                  value={shipment.ship_date ? formatDate(shipment.ship_date) : 'Not set'}
                />
                <Stat
                  label="Est. Arrival"
                  value={
                    eta
                      ? formatDate(eta.toISOString())
                      : shipment.ship_date
                        ? '—'
                        : 'Set sail date'
                  }
                />
                <Stat
                  label="Transit"
                  value={shipment.ship_date ? `~${getTransitDays(shipment.shipping_method)}d` : '—'}
                />
                <Stat label="Current Hub" value={HUB_LABELS[shipment.current_hub]} />
                <Stat
                  label="Container"
                  value={shipment.container_name ?? '—'}
                />
              </div>
            </div>

            {hasCapacity && (
              <div className="shrink-0 rounded-lg border px-3 py-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <CapacityBar label="Weight" used={totals.weight} max={shipment.weight_kg} unit="kg" />
                  <CapacityBar label="Volume" used={totals.volume} max={shipment.volume_cbm} unit="CBM" />
                  <CapacityBar label="Items" used={totals.quantity} max={shipment.max_item_quantity} unit="pcs" />
                </div>
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
              <p className="flex shrink-0 items-center gap-1.5 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                Products ({items.length})
              </p>
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No products loaded yet.</p>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-1.5 font-semibold">Product</th>
                        <th className="px-3 py-1.5 font-semibold">Qty</th>
                        <th className="px-3 py-1.5 font-semibold">Weight</th>
                        <th className="hidden px-3 py-1.5 font-semibold sm:table-cell">Client</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-medium">{item.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {item.quantity} {item.unit ?? 'pcs'}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {item.weight_kg ? `${item.weight_kg} kg` : '—'}
                          </td>
                          <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">
                            {item.clients?.name ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {shipment.description && (
              <p className="shrink-0 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Notes: </span>
                {shipment.description}
              </p>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="shrink-0 rounded-lg border p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Progress
              </p>
              <ShipmentTimeline status={shipment.status} variant="horizontal" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
              <p className="shrink-0 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent Activity
              </p>
              <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 text-xs">
                {events?.map((e) => (
                  <li key={e.id} className="rounded-md border px-2.5 py-1.5">
                    <p className="font-medium">{SHIPMENT_STATUS_LABELS[e.to_status]}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(e.created_at)}</p>
                  </li>
                ))}
                {!events?.length && (
                  <p className="px-1 py-4 text-center text-muted-foreground">No events yet.</p>
                )}
              </ol>
            </div>

            <Button asChild className="shrink-0 w-full">
              <Link to={manageHref} onClick={() => onOpenChange(false)}>
                Manage Shipment <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
