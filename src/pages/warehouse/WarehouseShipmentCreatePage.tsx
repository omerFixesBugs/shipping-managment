import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { HUB_LABELS } from '@/lib/constants'
import type { Client, ProcurementRequest } from '@/types/database'

export function WarehouseShipmentCreatePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [clientId, setClientId] = useState('')
  const [description, setDescription] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [procurementId, setProcurementId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const hub = profile?.hub

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return data as Client[]
    },
  })

  const { data: readyItems } = useQuery({
    queryKey: ['warehouse-ready-procurement', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('id, title')
        .eq('target_hub', hub!)
        .eq('status', 'ready_to_ship')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Pick<ProcurementRequest, 'id' | 'title'>[]
    },
    enabled: !!hub,
  })

  const createShipment = useMutation({
    mutationFn: async () => {
      if (!hub) throw new Error('Hub not set on your profile')

      const { data, error } = await supabase
        .from('shipments')
        .insert({
          client_id: clientId || null,
          type: procurementId ? 'business_sourced' : 'client_owned',
          origin_hub: hub,
          current_hub: hub,
          description: description || null,
          weight_kg: weightKg ? Number(weightKg) : null,
          procurement_request_id: procurementId || null,
          created_by: user!.id,
        })
        .select()
        .single()
      if (error) throw error

      // Copy products from linked procurement request into shipment items
      if (procurementId) {
        const { data: pr } = await supabase
          .from('procurement_requests').select('items').eq('id', procurementId).single()
        const prItems = (pr?.items ?? []) as { name: string; quantity: number; unit?: string; notes?: string; sourceUrl?: string; images?: string[] }[]
        if (prItems.length > 0) {
          await supabase.from('shipment_items').insert(
            prItems.map((it) => ({
              shipment_id: data.id,
              name: it.name,
              quantity: it.quantity ?? 1,
              unit: it.unit ?? 'pcs',
              notes: it.notes ?? null,
              source_url: it.sourceUrl ?? null,
              images: it.images ?? [],
              procurement_request_id: procurementId,
              created_by: user!.id,
            }))
          )
        }
      }

      // Record initial event
      await supabase.functions.invoke('shipment-status', {
        body: {
          type: 'shipment_status',
          shipmentId: data.id,
          newStatus: 'received_at_origin',
          actorId: user!.id,
        },
      })

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-shipments-list', hub] })
      navigate(`/warehouse/shipments/${data.id}`)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create shipment')
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add New Shipment"
        description={`Register inbound or outbound cargo for ${hub ? HUB_LABELS[hub] : 'your'} hub.`}
      />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="space-y-6 p-6">
          <FormSection title="Origin & Source">
            <div className="space-y-2">
              <Label>Link to Procurement Request <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select
                value={procurementId || '__none__'}
                onValueChange={(v) => setProcurementId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None — standalone shipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — standalone shipment</SelectItem>
                  {readyItems?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only "Ready to Ship" procurement requests are shown. Linking copies its products in.
              </p>
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
              <p className="text-xs text-muted-foreground">
                Leave empty for mixed shipments. Assign each product to its client after creating.
              </p>
            </div>
          </FormSection>

          <FormSection title="Cargo Details">
            <div className="space-y-2">
              <Label>Contents / Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's in this shipment…"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input
                type="number" min={0} step="0.01"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </FormSection>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => navigate('/warehouse/shipments')}>
              Cancel
            </Button>
            <Button
              onClick={() => { setError(null); createShipment.mutate() }}
              disabled={createShipment.isPending}
            >
              {createShipment.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
              ) : 'Create Shipment'}
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
