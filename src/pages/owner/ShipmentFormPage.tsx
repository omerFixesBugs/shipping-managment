import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { ShipmentTimeline } from '@/components/ShipmentTimeline'
import { ShipmentItemsManager } from '@/components/ShipmentItemsManager'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { Trash2 } from 'lucide-react'
import { ORIGIN_HUBS, HUB_LABELS, SHIPMENT_STATUS_LABELS, getNextShipmentStatuses, canManageShipmentItems } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import type { Client, HubType, Shipment, ShipmentEvent } from '@/types/database'

export function ShipmentFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  const [clientId, setClientId] = useState('')
  const [originHub, setOriginHub] = useState<HubType>('dubai')
  const [description, setDescription] = useState('')
  const [weightKg, setWeightKg] = useState('')

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      return data as Client[]
    },
  })

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
      if (error) throw error
      return data as ShipmentEvent[]
    },
    enabled: !isNew,
  })

  const createShipment = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .insert({
          client_id: clientId || null,
          type: 'client_owned',
          origin_hub: originHub,
          current_hub: originHub,
          description: description || null,
          weight_kg: weightKg ? Number(weightKg) : null,
          created_by: user!.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => navigate(`/owner/shipments/${data.id}`),
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

  if (!isNew && shipment) {
    const nextStatuses = getNextShipmentStatuses(
      shipment.status,
      profile?.role === 'owner' ? shipment.current_hub : profile?.hub ?? null
    )

    const canEditItems = canManageShipmentItems(shipment.status, 'owner', null, shipment.origin_hub)

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
          <CardHeader>
            <CardTitle>Products in this Shipment</CardTitle>
          </CardHeader>
          <CardContent>
            {!canEditItems && (
              <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Products are locked — shipment already dispatched from origin.
              </p>
            )}
            <ShipmentItemsManager shipmentId={shipment.id} canEdit={canEditItems} originHub={shipment.origin_hub} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ShipmentTimeline status={shipment.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Client:</strong> {shipment.clients?.name ?? 'Multiple / per-product'}</p>
            <p><strong>Origin:</strong> {HUB_LABELS[shipment.origin_hub]}</p>
            <p><strong>Current Hub:</strong> {HUB_LABELS[shipment.current_hub]}</p>
            <p><strong>Description:</strong> {shipment.description ?? '—'}</p>
            <p><strong>Weight:</strong> {shipment.weight_kg ? `${shipment.weight_kg} kg` : '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {events?.map((e) => (
                <li key={e.id} className="flex justify-between border-b py-2 last:border-0">
                  <span>
                    {e.from_status ? `${e.from_status} → ` : ''}{e.to_status}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
              {!events?.length && <p className="text-muted-foreground">No events yet.</p>}
            </ul>
          </CardContent>
        </Card>

        <OwnerShipmentControls shipment={shipment} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add New Shipment"
        description="Register a new shipment and assign cargo after creation."
      />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="space-y-6 p-6">
          <FormSection title="Origin & Destination">
            <div className="space-y-2">
              <Label>Origin Hub</Label>
              <Select value={originHub} onValueChange={(v) => setOriginHub(v as HubType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGIN_HUBS.map((h) => (
                    <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Destination defaults to Bangladesh.</p>
            </div>
          </FormSection>

          <FormSection title="Client Information">
            <div className="space-y-2">
              <Label>Primary Client <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Select value={clientId || '__none__'} onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None — multi-client shipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — multi-client shipment</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Add products and assign each to its client after creating.</p>
            </div>
          </FormSection>

          <FormSection title="Cargo Details">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
          </FormSection>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => navigate('/owner/shipments')}>
              Cancel
            </Button>
            <Button onClick={() => createShipment.mutate()} disabled={createShipment.isPending}>
              Create Shipment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
        {title}
      </h3>
      {children}
    </section>
  )
}

function OwnerShipmentControls({ shipment }: { shipment: Shipment }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [shipDate, setShipDate] = useState(shipment.created_at.slice(0, 10))

  const updateDate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shipments')
        .update({ created_at: new Date(shipDate).toISOString() })
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
    <Card className="border-red-200 dark:border-red-900/50">
      <CardHeader>
        <CardTitle className="text-base">Owner Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Shipment Date</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
              className="max-w-xs"
            />
            <PasswordConfirmDialog
              trigger={<Button variant="outline" disabled={shipDate === shipment.created_at.slice(0, 10)}>Save Date</Button>}
              title="Change Shipment Date"
              description="Confirm your password to update this shipment's date."
              actionLabel="Update Date"
              onConfirmed={() => updateDate.mutateAsync()}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <PasswordConfirmDialog
            trigger={
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Shipment
              </Button>
            }
            title="Delete Shipment"
            description={`Permanently delete shipment ${shipment.reference_code} and all its products. This cannot be undone.`}
            actionLabel="Delete Shipment"
            destructive
            onConfirmed={() => deleteShipment.mutateAsync()}
          />
        </div>
      </CardContent>
    </Card>
  )
}
