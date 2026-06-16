import { useState, useEffect } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { ShipmentTimeline } from '@/components/ShipmentTimeline'
import { ShipmentItemsManager } from '@/components/ShipmentItemsManager'
import { AddShipmentDialog } from '@/components/AddShipmentDialog'
import { HUB_LABELS, ORIGIN_HUBS, SHIPMENT_STATUS_LABELS, getNextShipmentStatuses, canManageShipmentItems } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import type { HubType, Shipment, ShipmentEvent } from '@/types/database'

type ListShipment = Shipment & {
  clients: { name: string } | null
  shipment_items: { id: string }[]
}

function ShipmentTable({ rows }: { rows: ListShipment[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No shipments.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-3 font-medium">Reference</th>
          <th className="pb-3 font-medium">Client</th>
          <th className="pb-3 font-medium">Products</th>
          <th className="pb-3 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id} className="border-b last:border-0">
            <td className="py-3">
              <Link to={`/warehouse/shipments/${s.id}`} className="font-medium hover:underline" style={{ color: 'var(--hub)' }}>
                {s.reference_code}
              </Link>
            </td>
            <td className="py-3">{s.clients?.name ?? '—'}</td>
            <td className="py-3">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />{s.shipment_items?.length ?? 0}
              </span>
            </td>
            <td className="py-3"><ShipmentStatusBadge status={s.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function WarehouseShipmentsListPage() {
  const { profile } = useAuth()
  const hub = profile?.hub
  const isBD = hub === 'bangladesh'
  const locationState = useLocation().state as { openCreate?: boolean } | null
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (locationState?.openCreate) {
      setAddOpen(true)
      // Clear state so re-visits don't re-open
      window.history.replaceState({}, '')
    }
  }, [locationState?.openCreate])

  const { data: shipments } = useQuery({
    queryKey: ['warehouse-shipments-list', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name), shipment_items(id)')
        .or(`origin_hub.eq.${hub},current_hub.eq.${hub}`)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as ListShipment[]
    },
    enabled: !!hub,
  })

  return (
    <div className="space-y-6">
      <AddShipmentDialog open={addOpen} onOpenChange={setAddOpen} />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Shipments</h2>
        {!isBD && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />New Shipment
          </Button>
        )}
      </div>

      {isBD ? (
        // Bangladesh: group incoming shipments by origin hub
        ORIGIN_HUBS.map((origin: HubType) => {
          const rows = shipments?.filter((s) => s.origin_hub === origin) ?? []
          return (
            <Card key={origin}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: origin === 'dubai' ? '#f59e0b' : '#ef4444' }} />
                  <CardTitle>Incoming from {HUB_LABELS[origin]}</CardTitle>
                  <span className="text-sm text-muted-foreground">({rows.length})</span>
                </div>
              </CardHeader>
              <CardContent><ShipmentTable rows={rows} /></CardContent>
            </Card>
          )
        })
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ShipmentTable rows={shipments ?? []} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function WarehouseShipmentDetailPage() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  const { data: shipment } = useQuery({
    queryKey: ['shipment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name, phone)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Shipment & { clients: { name: string; phone: string } }
    },
  })

  const { data: events } = useQuery({
    queryKey: ['shipment-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ShipmentEvent[]
    },
  })

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.functions.invoke('shipment-status', {
        body: {
          type: 'shipment_status',
          shipmentId: id,
          newStatus,
          actorId: user!.id,
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['shipment-events', id] })
    },
  })

  if (!shipment) return <p className="text-muted-foreground">Loading...</p>

  const nextStatuses = getNextShipmentStatuses(shipment.status, profile?.hub ?? null)
  const canEditItems = canManageShipmentItems(shipment.status, 'warehouse_manager', profile?.hub, shipment.origin_hub)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <h2 className="text-2xl font-bold">{shipment.reference_code}</h2>
          <p className="text-xs text-muted-foreground">
            {HUB_LABELS[shipment.origin_hub]} → {HUB_LABELS[shipment.current_hub]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShipmentStatusBadge status={shipment.status} />
          {nextStatuses.map((status) => (
            <Button
              key={status}
              size="sm"
              onClick={() => updateStatus.mutate(status)}
              disabled={updateStatus.isPending}
            >
              Mark as {SHIPMENT_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Products in this Shipment</CardTitle></CardHeader>
        <CardContent>
          {!canEditItems && (
            <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {shipment.origin_hub === profile?.hub
                ? 'Products are locked — shipment already dispatched from origin.'
                : 'View only — only the origin hub and head office can change products.'}
            </p>
          )}
          <ShipmentItemsManager shipmentId={shipment.id} canEdit={canEditItems} originHub={shipment.origin_hub} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
        <CardContent>
          <ShipmentTimeline status={shipment.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Client:</strong> {shipment.clients?.name ?? 'Multiple / per-product'}</p>
          <p><strong>Origin:</strong> {HUB_LABELS[shipment.origin_hub]}</p>
          <p><strong>Current Hub:</strong> {HUB_LABELS[shipment.current_hub]}</p>
          <p><strong>Description:</strong> {shipment.description ?? '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Event History</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {events?.map((e) => (
              <li key={e.id} className="flex justify-between border-b py-2">
                <span>{e.from_status ? `${e.from_status} → ` : ''}{e.to_status}</span>
                <span className="text-muted-foreground">{formatDateTime(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
