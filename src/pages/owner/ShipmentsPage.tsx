import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Download, MessageSquare, Search, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { AddShipmentDialog } from '@/components/AddShipmentDialog'
import {
  HUB_LABELS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_ORDER,
} from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Shipment, ShipmentEvent } from '@/types/database'

type ListShipment = Shipment & {
  clients: { name: string } | null
  shipment_items: { id: string }[]
}

type RouteTab = 'all' | 'dubai' | 'china'

const ROUTE_TABS: { id: RouteTab; label: string }[] = [
  { id: 'all', label: 'All Routes' },
  { id: 'dubai', label: 'Dubai Origin' },
  { id: 'china', label: 'China Origin' },
]

function progressPct(status: Shipment['status']) {
  const idx = SHIPMENT_STATUS_ORDER.indexOf(status)
  return Math.round((idx / (SHIPMENT_STATUS_ORDER.length - 1)) * 100)
}

export function ShipmentsPage() {
  const [tab, setTab] = useState<RouteTab>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['shipments-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name), shipment_items(id)')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as ListShipment[]
    },
  })

  const filtered = useMemo(() => {
    return (shipments ?? []).filter(
      (s) =>
        (tab === 'all' || s.origin_hub === tab) &&
        (!search ||
          s.reference_code.toLowerCase().includes(search.toLowerCase()) ||
          s.clients?.name?.toLowerCase().includes(search.toLowerCase()))
    )
  }, [shipments, tab, search])

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null

  const exportCsv = () => {
    if (!filtered.length) return
    const headers = ['Reference', 'Client', 'Type', 'Origin', 'Current Hub', 'Status']
    const rows = filtered.map((s) => [
      s.reference_code,
      s.clients?.name ?? '',
      s.type,
      s.origin_hub,
      s.current_hub,
      s.status,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'shipments.csv'
    a.click()
  }

  return (
    <div className="space-y-6">
      <AddShipmentDialog open={addOpen} onOpenChange={setAddOpen} />
      <PageHeader
        title="Active Shipments"
        description="Real-time tracking of client and business-sourced cargo."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Truck className="h-4 w-4" /> New Shipment
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tracking table */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {ROUTE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    tab === t.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative ml-auto min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by reference or client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  No shipments found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Reference</th>
                        <th className="px-4 py-3 font-semibold">Client</th>
                        <th className="px-4 py-3 font-semibold">Route</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const isActive = selected?.id === s.id
                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedId(s.id)}
                            className={cn(
                              'cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/40',
                              isActive && 'bg-accent/50'
                            )}
                          >
                            <td className="px-4 py-3">
                              <span className="font-data font-medium text-[var(--color-brand)]">
                                {s.reference_code}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {s.shipment_items?.length ?? 0} items
                              </p>
                            </td>
                            <td className="px-4 py-3">{s.clients?.name ?? '—'}</td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-muted-foreground">
                                {HUB_LABELS[s.origin_hub]} → {HUB_LABELS[s.current_hub]}
                              </p>
                              <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-[var(--color-brand)]"
                                  style={{ width: `${progressPct(s.status)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <ShipmentStatusBadge status={s.status} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {shipments?.length ?? 0} shipments
          </p>
        </div>

        {/* Selected shipment + comms */}
        <div className="lg:col-span-1">
          {selected ? (
            <ShipmentTrackingPanel shipment={selected} />
          ) : (
            <Card className="shadow-[var(--shadow-card)]">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Select a shipment to view tracking.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ShipmentTrackingPanel({ shipment }: { shipment: ListShipment }) {
  const { data: events } = useQuery({
    queryKey: ['shipment-events', shipment.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data as ShipmentEvent[]
    },
  })

  return (
    <div className="sticky top-6 space-y-6">
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="font-data text-base">{shipment.reference_code}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {shipment.clients?.name ?? 'Multiple clients'} ·{' '}
              {shipment.type.replace('_', ' ')}
            </p>
          </div>
          <ShipmentStatusBadge status={shipment.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{HUB_LABELS[shipment.origin_hub]}</span>
            <span className="text-muted-foreground">In Transit</span>
            <span>{HUB_LABELS.bangladesh}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--color-brand)]"
              style={{ width: `${progressPct(shipment.status)}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="font-data text-sm font-semibold">
                {shipment.weight_kg ? `${shipment.weight_kg} kg` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Items</p>
              <p className="font-data text-sm font-semibold">
                {shipment.shipment_items?.length ?? 0}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to={`/owner/shipments/${shipment.id}`}>
              Open shipment <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--color-brand)]" />
          <CardTitle className="text-base">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l pl-4">
            {events?.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)] ring-4 ring-card" />
                <p className="text-sm font-medium">{SHIPMENT_STATUS_LABELS[e.to_status]}</p>
                {e.notes ? (
                  <p className="text-xs text-muted-foreground">{e.notes}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
              </li>
            ))}
            {!events?.length && (
              <li className="text-sm text-muted-foreground">No events recorded.</li>
            )}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
