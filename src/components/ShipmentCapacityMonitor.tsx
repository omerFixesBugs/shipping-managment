import { useQuery } from '@tanstack/react-query'
import { Scale } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { sumLineTotals } from '@/lib/shipmentCapacity'
import { cn } from '@/lib/utils'
import type { Shipment, ShipmentItem } from '@/types/database'

function CapacityBar({
  label,
  used,
  max,
  unit,
}: {
  label: string
  used: number
  max: number | null | undefined
  unit: string
}) {
  if (max == null || max <= 0) {
    return (
      <div className="rounded-lg border bg-muted/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-data text-sm font-semibold">
          {used.toFixed(unit === 'pcs' ? 0 : unit === 'CBM' ? 3 : 1)} {unit}
          <span className="ml-1 text-xs font-normal text-muted-foreground">(no limit)</span>
        </p>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((used / max) * 100))
  const over = used > max

  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('font-data text-xs font-semibold', over && 'text-red-600')}>
          {used.toFixed(unit === 'pcs' ? 0 : unit === 'CBM' ? 3 : 1)} / {max} {unit}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', over ? 'bg-red-500' : 'bg-[var(--color-brand)]')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{pct}% used</p>
    </div>
  )
}

type ShipmentCapacityMonitorProps = {
  shipmentId: string
  limits?: Pick<Shipment, 'weight_kg' | 'volume_cbm' | 'max_item_quantity'> | null
  compact?: boolean
}

export function ShipmentCapacityMonitor({ shipmentId, limits, compact }: ShipmentCapacityMonitorProps) {
  const { data: lineItems } = useQuery({
    queryKey: ['shipment-items', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_items')
        .select('quantity, weight_kg, volume_cbm')
        .eq('shipment_id', shipmentId)
      if (error) throw error
      return data as Pick<ShipmentItem, 'quantity' | 'weight_kg' | 'volume_cbm'>[]
    },
  })

  const totals = sumLineTotals(lineItems ?? [])
  const hasLimits = limits?.weight_kg || limits?.volume_cbm || limits?.max_item_quantity

  if (!lineItems?.length && !hasLimits) return null

  return (
    <div className={cn('rounded-lg border bg-card', compact ? 'p-3' : 'p-4')}>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Scale className="h-3.5 w-3.5" />
        Capacity Monitor
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <CapacityBar label="Weight" used={totals.weight} max={limits?.weight_kg} unit="kg" />
        <CapacityBar label="Volume" used={totals.volume} max={limits?.volume_cbm} unit="CBM" />
        <CapacityBar label="Items" used={totals.quantity} max={limits?.max_item_quantity} unit="pcs" />
      </div>
      {lineItems && lineItems.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Total cargo weight: <span className="font-data font-semibold text-foreground">{totals.weight.toFixed(2)} kg</span>
          {lineItems.length > 1 ? ` across ${lineItems.length} products` : ''}
        </p>
      )}
    </div>
  )
}
