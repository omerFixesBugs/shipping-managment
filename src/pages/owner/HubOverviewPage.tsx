import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS, HUB_THEMES, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_ORDER } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { HubType, Shipment, ShipmentStatus } from '@/types/database'

type HubShipment = Shipment & {
  clients: { name: string } | null
  creator: { full_name: string } | null
  shipment_items: { id: string; name: string; quantity: number; unit: string | null }[]
}

const HUBS: HubType[] = ['dubai', 'china', 'bangladesh']

export function HubOverviewPage() {
  const [hub, setHub] = useState<HubType>('dubai')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['hub-overview', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name), creator:profiles!shipments_created_by_fkey(full_name), shipment_items(id, name, quantity, unit)')
        .or(`origin_hub.eq.${hub},current_hub.eq.${hub}`)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as HubShipment[]
    },
  })

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const statusCounts = SHIPMENT_STATUS_ORDER.map((s) => ({
    status: s,
    count: shipments?.filter((sh) => sh.status === s).length ?? 0,
  }))

  const inProcess = shipments?.filter((s) => s.status !== 'delivered').length ?? 0
  const theme = HUB_THEMES[hub]

  return (
    <div
      className="space-y-6"
      style={{ ['--hub' as string]: theme.accent, ['--hub-soft' as string]: theme.accentSoft }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Hub Overview</h2>
        <Select value={hub} onValueChange={(v) => setHub(v as HubType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HUBS.map((h) => (
              <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Card style={{ backgroundColor: 'var(--hub-soft)' }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">In Process</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--hub)' }}>{inProcess}</p>
          </CardContent>
        </Card>
        {statusCounts.map(({ status, count }) => (
          <Card key={status}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{SHIPMENT_STATUS_LABELS[status]}</p>
              <p className="text-2xl font-bold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Shipments + products */}
      <Card>
        <CardHeader>
          <CardTitle>{HUB_LABELS[hub]} Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : shipments?.length === 0 ? (
            <p className="text-muted-foreground">No shipments at this hub.</p>
          ) : (
            <div className="space-y-2">
              {shipments?.map((s) => {
                const isOpen = expanded.has(s.id)
                return (
                  <div key={s.id} className="rounded-lg border">
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/owner/shipments/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium hover:underline"
                            style={{ color: 'var(--hub)' }}
                          >
                            {s.reference_code}
                          </Link>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Package className="h-3 w-3" />{s.shipment_items?.length ?? 0}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.clients?.name ?? '—'} · {HUB_LABELS[s.origin_hub]} → {HUB_LABELS[s.current_hub]} · added by {s.creator?.full_name ?? '—'}
                        </p>
                      </div>
                      <ShipmentStatusBadge status={s.status as ShipmentStatus} />
                    </button>

                    {isOpen && (
                      <div className="border-t bg-muted/30 p-3">
                        {s.shipment_items?.length ? (
                          <ul className="space-y-1">
                            {s.shipment_items.map((it) => (
                              <li key={it.id} className={cn('flex justify-between text-sm')}>
                                <span>{it.name}</span>
                                <span className="text-muted-foreground">{it.quantity} {it.unit}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No products listed in this shipment.</p>
                        )}
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Created {formatDateTime(s.created_at)} · Updated {formatDateTime(s.updated_at)}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
