import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { ShipmentTimeline } from '@/components/ShipmentTimeline'
import { ShipmentItemsManager } from '@/components/ShipmentItemsManager'
import { ShipmentCapacityMonitor } from '@/components/ShipmentCapacityMonitor'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { Trash2 } from 'lucide-react'
import { HUB_LABELS, SHIPMENT_STATUS_LABELS, getNextShipmentStatuses, canManageShipmentItems } from '@/lib/constants'
import {
  formatShippingMethod,
  getEstimatedArrivalDate,
  getTransitDays,
} from '@/lib/shipmentSchedule'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Shipment, ShipmentEvent } from '@/types/database'

function VoyageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-data text-sm font-semibold">{value}</p>
    </div>
  )
}

export function ShipmentFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

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
    enabled: !isNew,
  })

  const { data: events } = useQuery({
    queryKey: ['shipment-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', id!)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data as ShipmentEvent[]
    },
    enabled: !isNew,
  })


  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { data, error } = await supabase.functions.invoke('shipment-status', {
        body: {
          type: 'shipment_status',
          shipmentId: id,
          newStatus,
          actorId: user!.id,
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['shipment-events', id] })
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
    },
  })

  if (isNew) {
    return <Navigate to="/owner/shipments" replace />
  }

  if (!isNew && shipment) {
    const nextStatuses = getNextShipmentStatuses(
      shipment.status,
      profile?.role === 'owner' ? shipment.current_hub : profile?.hub ?? null
    )

    const canEditItems = canManageShipmentItems(shipment.status, 'owner', null, shipment.origin_hub)
    const dest = shipment.destination_hub ?? 'bangladesh'
    const eta = getEstimatedArrivalDate(shipment.ship_date, shipment.shipping_method)

    return (
      <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-7xl flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-data text-xl font-bold">{shipment.reference_code}</h2>
            <p className="text-xs text-muted-foreground">
              {HUB_LABELS[shipment.origin_hub]} → {HUB_LABELS[dest]} · {formatShippingMethod(shipment.shipping_method)}
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

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <VoyageStat
            label="Sail Date"
            value={shipment.ship_date ? formatDate(shipment.ship_date) : 'Not scheduled'}
          />
          <VoyageStat label="Est. Arrival" value={eta ? formatDate(eta.toISOString()) : '—'} />
          <VoyageStat
            label="Transit"
            value={shipment.ship_date ? `~${getTransitDays(shipment.shipping_method)} days` : '—'}
          />
          <VoyageStat label="Container" value={shipment.container_name ?? '—'} />
          <VoyageStat label="Destination" value={HUB_LABELS[dest]} />
          <VoyageStat label="Current Hub" value={HUB_LABELS[shipment.current_hub]} />
        </div>

        <ShipmentCapacityMonitor shipmentId={shipment.id} limits={shipment} compact />

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_300px]">
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader className="shrink-0 border-b py-3">
              <CardTitle className="text-base">Products in this Shipment</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto pt-4">
              {!canEditItems && (
                <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Products are locked — shipment already dispatched from origin.
                </p>
              )}
              <ShipmentItemsManager shipmentId={shipment.id} canEdit={canEditItems} originHub={shipment.origin_hub} />
            </CardContent>
          </Card>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <Card className="shrink-0">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Progress</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ShipmentTimeline status={shipment.status} variant="horizontal" />
              </CardContent>
            </Card>

            <Card className="shrink-0">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 pt-0 text-xs">
                <p><span className="text-muted-foreground">Client:</span> {shipment.clients?.name ?? 'Multiple / per-product'}</p>
                <p><span className="text-muted-foreground">Type:</span> {shipment.type.replace('_', ' ')}</p>
                <p><span className="text-muted-foreground">Max Weight:</span> {shipment.weight_kg ? `${shipment.weight_kg} kg` : '—'}</p>
                <p><span className="text-muted-foreground">Max Volume:</span> {shipment.volume_cbm ? `${shipment.volume_cbm} CBM` : '—'}</p>
                <p><span className="text-muted-foreground">Max Items:</span> {shipment.max_item_quantity ?? '—'}</p>
                {shipment.description && (
                  <p className="mt-1 border-t pt-2 text-muted-foreground">{shipment.description}</p>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardHeader className="shrink-0 border-b py-3">
                <CardTitle className="text-base">Event History</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto pt-3">
                <ul className="space-y-1.5 text-xs">
                  {events?.map((e) => (
                    <li key={e.id} className="flex justify-between gap-2 border-b py-1.5 last:border-0">
                      <span className="font-medium">
                        {e.from_status ? `${e.from_status} → ` : ''}{e.to_status}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{formatDateTime(e.created_at)}</span>
                    </li>
                  ))}
                  {!events?.length && <p className="text-muted-foreground">No events yet.</p>}
                </ul>
              </CardContent>
            </Card>

            <OwnerShipmentControls shipment={shipment} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      Loading shipment…
    </div>
  )
}


function OwnerShipmentControls({ shipment }: { shipment: Shipment }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [shipDate, setShipDate] = useState(shipment.ship_date ?? '')

  const updateDate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shipments')
        .update({ ship_date: shipDate || null })
        .eq('id', shipment.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipment', shipment.id] }),
  })

  const deleteShipment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('shipments').delete().eq('id', shipment.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      navigate('/owner/shipments')
    },
  })

  return (
    <Card className="shrink-0 border-red-200 dark:border-red-900/50">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Owner Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1.5">
          <Label className="text-xs">Sail Date</Label>
          <div className="flex gap-2">
            <DateField
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
              className="h-8 text-xs"
              showClear={false}
            />
            <PasswordConfirmDialog
              trigger={
                <Button variant="outline" size="sm" disabled={shipDate === (shipment.ship_date ?? '')}>
                  Save
                </Button>
              }
              title="Change Sail Date"
              description="Confirm your password to update this shipment's sailing date."
              actionLabel="Update Date"
              onConfirmed={() => updateDate.mutateAsync()}
            />
          </div>
        </div>

        <PasswordConfirmDialog
          trigger={
            <Button variant="destructive" size="sm" className="w-full">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Shipment
            </Button>
          }
          title="Delete Shipment"
          description={`Permanently delete shipment ${shipment.reference_code} and all its products. This cannot be undone.`}
          actionLabel="Delete Shipment"
          destructive
          onConfirmed={() => deleteShipment.mutateAsync()}
        />
      </CardContent>
    </Card>
  )
}
