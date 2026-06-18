import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Search, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { AddShipmentDialog } from '@/components/AddShipmentDialog'
import {
  ShipmentStatusBoard,
  SHIPMENT_STATUS_SECTIONS,
  type BoardShipment,
} from '@/components/ShipmentStatusBoard'
import { ShipmentSummaryDialog } from '@/components/ShipmentSummaryDialog'
import { HUB_LABELS } from '@/lib/constants'

type RouteTab = 'all' | 'dubai' | 'china'

const ROUTE_TABS: { id: RouteTab; label: string }[] = [
  { id: 'all', label: 'All Routes' },
  { id: 'dubai', label: 'Dubai Origin' },
  { id: 'china', label: 'China Origin' },
]

export function ShipmentsPage() {
  const [tab, setTab] = useState<RouteTab>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<BoardShipment | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['shipments-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select(
          '*, clients(name), shipment_items(id, name, quantity, unit, weight_kg, volume_cbm, clients(name))'
        )
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as BoardShipment[]
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (shipments ?? []).filter((s) => {
      if (tab !== 'all' && s.origin_hub !== tab) return false
      if (!q) return true
      return (
        s.reference_code.toLowerCase().includes(q) ||
        s.clients?.name?.toLowerCase().includes(q) ||
        s.container_name?.toLowerCase().includes(q) ||
        s.shipment_items?.some((i) => i.name.toLowerCase().includes(q))
      )
    })
  }, [shipments, tab, search])

  const activeColumns = useMemo(
    () => SHIPMENT_STATUS_SECTIONS.filter((s) => filtered.some((sh) => sh.status === s.status)).length,
    [filtered]
  )

  const exportCsv = () => {
    if (!filtered.length) return
    const headers = ['Reference', 'Client', 'Origin', 'Destination', 'Status', 'Sail Date', 'Container', 'Items']
    const rows = filtered.map((s) => [
      s.reference_code,
      s.clients?.name ?? '',
      s.origin_hub,
      s.destination_hub ?? 'bangladesh',
      s.status,
      s.ship_date ?? '',
      s.container_name ?? '',
      s.shipment_items?.length ?? 0,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'shipments.csv'
    a.click()
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <AddShipmentDialog open={addOpen} onOpenChange={setAddOpen} />
      <PageHeader
        title="Logistics Tracking"
        description="Monitor every shipment by status — cargo, sailing schedule, and estimated arrival."
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

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {ROUTE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full min-w-[200px] sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reference, client, container, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ShipmentStatusBoard
          shipments={filtered}
          isLoading={isLoading}
          onShipmentClick={setSelected}
          hideEmptyColumns={search.trim().length > 0 || tab !== 'all'}
          emptyMessage={
            search.trim() || tab !== 'all'
              ? 'No shipments match your filters.'
              : 'No shipments yet. Create one to start tracking cargo.'
          }
        />
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="shrink-0 text-xs text-muted-foreground">
          {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
          {tab !== 'all' ? ` from ${HUB_LABELS[tab]}` : ''}
          {search.trim() ? ' matching search' : ''} · {activeColumns} active status column
          {activeColumns !== 1 ? 's' : ''}
        </p>
      )}

      <ShipmentSummaryDialog
        shipment={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        manageHref={selected ? `/owner/shipments/${selected.id}` : '#'}
      />
    </div>
  )
}
