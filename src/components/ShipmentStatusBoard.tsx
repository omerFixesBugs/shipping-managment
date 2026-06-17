import { Anchor, Calendar, Container, Package, Plane, Ship } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_ORDER } from '@/lib/constants'
import { getEstimatedArrivalDate, formatShippingMethod } from '@/lib/shipmentSchedule'
import { formatDate } from '@/lib/utils'
import type { Shipment, ShipmentItem, ShipmentStatus } from '@/types/database'

export type BoardShipment = Shipment & {
  clients: { name: string } | null
  shipment_items: Pick<
    ShipmentItem,
    'id' | 'name' | 'quantity' | 'unit' | 'weight_kg' | 'volume_cbm' | 'clients'
  >[]
}

export type ShipmentStatusSection = {
  status: ShipmentStatus
  label: string
  accent: string
}

export const SHIPMENT_STATUS_SECTIONS: ShipmentStatusSection[] = [
  { status: 'received_at_origin', label: 'At Origin', accent: '#94a3b8' },
  { status: 'preparing_export', label: 'Preparing Export', accent: '#3b82f6' },
  { status: 'in_transit_to_bangladesh', label: 'In Transit', accent: '#f59e0b' },
  { status: 'arrived_bangladesh', label: 'Arrived BD', accent: '#8b5cf6' },
  { status: 'ready_for_pickup', label: 'Ready Pickup', accent: '#10b981' },
  { status: 'out_for_delivery', label: 'Out for Delivery', accent: '#06b6d4' },
  { status: 'delivered', label: 'Delivered', accent: '#22c55e' },
]

type ShipmentStatusBoardProps = {
  shipments: BoardShipment[]
  isLoading?: boolean
  onShipmentClick: (shipment: BoardShipment) => void
  emptyMessage?: string
  hideEmptyColumns?: boolean
}

export function groupShipmentsByStatus(
  shipments: BoardShipment[],
  sections: ShipmentStatusSection[],
  hideEmptyColumns = false
) {
  const byStatus = new Map<ShipmentStatus, BoardShipment[]>()
  for (const s of shipments) {
    const list = byStatus.get(s.status) ?? []
    list.push(s)
    byStatus.set(s.status, list)
  }
  const grouped = sections.map((section) => ({
    ...section,
    shipments: byStatus.get(section.status) ?? [],
  }))
  return hideEmptyColumns ? grouped.filter((s) => s.shipments.length > 0) : grouped
}

function progressPct(status: ShipmentStatus) {
  const idx = SHIPMENT_STATUS_ORDER.indexOf(status)
  return Math.round((idx / (SHIPMENT_STATUS_ORDER.length - 1)) * 100)
}

export function ShipmentStatusBoard({
  shipments,
  isLoading,
  onShipmentClick,
  emptyMessage = 'No shipments found.',
  hideEmptyColumns = false,
}: ShipmentStatusBoardProps) {
  const grouped = groupShipmentsByStatus(shipments, SHIPMENT_STATUS_SECTIONS, hideEmptyColumns)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading shipment board…</p>
      </div>
    )
  }

  if (grouped.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-muted/20">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-1">
      {grouped.map((section) => (
        <div
          key={section.status}
          className="flex w-[min(100%,320px)] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <div
            className="shrink-0 border-b px-4 py-3"
            style={{ borderTopWidth: 3, borderTopColor: section.accent, borderTopStyle: 'solid' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{section.label}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {SHIPMENT_STATUS_LABELS[section.status]}
                </p>
              </div>
              <span
                className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: section.accent }}
              >
                {section.shipments.length}
              </span>
            </div>
          </div>

          <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 overflow-y-auto p-3">
            {section.shipments.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 py-8 text-center">
                <p className="text-xs text-muted-foreground">No shipments</p>
              </div>
            ) : (
              section.shipments.map((shipment) => (
                <ShipmentCard
                  key={shipment.id}
                  shipment={shipment}
                  onClick={() => onShipmentClick(shipment)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ShipmentCard({ shipment, onClick }: { shipment: BoardShipment; onClick: () => void }) {
  const dest = shipment.destination_hub ?? 'bangladesh'
  const eta = getEstimatedArrivalDate(shipment.ship_date, shipment.shipping_method)
  const itemCount = shipment.shipment_items?.length ?? 0
  const totalWeight = shipment.shipment_items?.reduce((s, i) => s + (Number(i.weight_kg) || 0), 0) ?? 0
  const isAir = shipment.shipping_method === 'air'

  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <Card className="overflow-hidden border bg-background/80 transition-all hover:border-primary/30 hover:shadow-md">
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-data text-sm font-bold text-[var(--color-brand)] group-hover:text-primary">
                {shipment.reference_code}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {HUB_LABELS[shipment.origin_hub]} → {HUB_LABELS[dest]}
              </p>
            </div>
            <ShipmentStatusBadge status={shipment.status} />
          </div>

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--color-brand)]"
              style={{ width: `${progressPct(shipment.status)}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t pt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              {isAir ? <Plane className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
              {formatShippingMethod(shipment.shipping_method)}
            </span>
            {shipment.ship_date && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {formatDate(shipment.ship_date)}
                </span>
              </>
            )}
            {eta && shipment.status !== 'delivered' && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                  <Anchor className="h-3 w-3" />
                  ETA {formatDate(eta.toISOString())}
                </span>
              </>
            )}
            <span>·</span>
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              <Package className="h-3 w-3" />
              {itemCount} item{itemCount !== 1 ? 's' : ''}
              {totalWeight > 0 ? ` · ${totalWeight.toFixed(1)} kg` : ''}
            </span>
            {shipment.container_name && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 truncate">
                  <Container className="h-3 w-3 shrink-0" />
                  {shipment.container_name}
                </span>
              </>
            )}
          </div>

          {shipment.clients?.name && (
            <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
              {shipment.clients.name}
            </p>
          )}
        </div>
      </Card>
    </button>
  )
}
