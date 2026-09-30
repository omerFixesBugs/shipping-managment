import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateField } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ORIGIN_HUBS, HUB_LABELS, getDestinationHubs } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { HubType } from '@/types/database'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (shipmentId: string) => void
}

const BLANK = {
  description: '',
  maxWeightKg: '',
  maxVolumeCbm: '',
  maxQuantity: '',
  shippingMethod: 'sea' as 'sea' | 'air',
  destinationHub: '' as HubType | '',
  shipDate: '',
  containerName: '',
}
// sdfsd
export function AddShipmentDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isOwner = profile?.role === 'owner'

  const [originHub, setOriginHub] = useState<HubType>(
    isOwner ? 'dubai' : ((profile?.hub ?? 'dubai') as HubType)
  )
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState<string | null>(null)

  const destinationOptions = useMemo(() => getDestinationHubs(originHub), [originHub])

  useEffect(() => {
    if (!isOwner && profile?.hub) setOriginHub(profile.hub)
  }, [profile?.hub, isOwner])

  useEffect(() => {
    if (destinationOptions.length && !destinationOptions.includes(form.destinationHub as HubType)) {
      setForm((f) => ({ ...f, destinationHub: destinationOptions[0] }))
    }
  }, [destinationOptions, form.destinationHub])

  const createShipment = useMutation({
    mutationFn: async () => {
      const hub = isOwner ? originHub : ((profile?.hub ?? 'dubai') as HubType)
      if (!form.destinationHub) throw new Error('Select a destination hub')

      const payload: Record<string, unknown> = {
        client_id: null,
        type: 'business_sourced',
        origin_hub: hub,
        current_hub: hub,
        description: form.description || null,
        weight_kg: form.maxWeightKg ? Number(form.maxWeightKg) : null,
        created_by: user!.id,
      }

      const extended = {
        ...payload,
        destination_hub: form.destinationHub,
        ship_date: form.shipDate || null,
        container_name: form.containerName || null,
        volume_cbm: form.maxVolumeCbm ? Number(form.maxVolumeCbm) : null,
        max_item_quantity: form.maxQuantity ? Number(form.maxQuantity) : null,
        shipping_method: form.shippingMethod,
      }

      let { data, error: insertError } = await supabase
        .from('shipments')
        .insert(extended)
        .select()
        .single()

      if (insertError?.message?.includes('column')) {
        const fallback = await supabase.from('shipments').insert(payload).select().single()
        if (fallback.error) throw fallback.error
        data = fallback.data
      } else if (insertError) {
        throw insertError
      }

      if (!isOwner) {
        await supabase.functions.invoke('shipment-status', {
          body: {
            type: 'shipment_status',
            shipmentId: data!.id,
            newStatus: 'received_at_origin',
            actorId: user!.id,
          },
        })
      }

      return data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['shipments-tracking'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-shipments-list'] })
      queryClient.invalidateQueries({ queryKey: ['open-shipments'] })
      reset()
      onOpenChange(false)
      if (onSuccess) {
        onSuccess(data.id)
      } else {
        const base = isOwner ? '/owner/shipments' : '/warehouse/shipments'
        navigate(`${base}/${data.id}`)
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create shipment')
    },
  })

  function reset() {
    setForm(BLANK)
    setError(null)
    if (isOwner) setOriginHub('dubai')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Shipment / Container</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
              Route
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Origin Hub</Label>
                {isOwner ? (
                  <Select
                    value={originHub}
                    onValueChange={(v) => {
                      setOriginHub(v as HubType)
                      set('destinationHub', '')
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORIGIN_HUBS.map((h) => (
                        <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={HUB_LABELS[profile?.hub ?? 'dubai']} disabled />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Destination Hub</Label>
                <Select
                  value={form.destinationHub || destinationOptions[0]}
                  onValueChange={(v) => set('destinationHub', v as HubType)}
                >
                  <SelectTrigger><SelectValue placeholder="Select hub" /></SelectTrigger>
                  <SelectContent>
                    {destinationOptions.map((h) => (
                      <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Planned Ship Date</Label>
              <DateField
                value={form.shipDate}
                onChange={(e) => set('shipDate', e.target.value)}
                showClear={false}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
              Container / Reference
            </h3>
            <div className="space-y-1.5">
              <Label>Container or Batch Name</Label>
              <Input
                placeholder="e.g. CONT-DXB-0426, Air batch #12"
                value={form.containerName}
                onChange={(e) => set('containerName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Cargo summary, special handling…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
              Capacity Limits
            </h3>
            <p className="text-xs text-muted-foreground">
              Max totals for this shipment. Storage products cannot be added if they would exceed these limits.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Max Weight (kg)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={form.maxWeightKg}
                  onChange={(e) => set('maxWeightKg', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Volume (CBM)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  placeholder="0"
                  value={form.maxVolumeCbm}
                  onChange={(e) => set('maxVolumeCbm', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Items (pcs)</Label>
                <Input
                  type="number"
                  min={1}
                  step="1"
                  placeholder="0"
                  value={form.maxQuantity}
                  onChange={(e) => set('maxQuantity', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
              Shipping Method
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: 'sea', title: 'Sea Freight', sub: 'Container / standard' },
                  { value: 'air', title: 'Air Freight', sub: 'Express' },
                ] as const
              ).map(({ value, title, sub }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('shippingMethod', value)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    form.shippingMethod === value
                      ? 'border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_8%,transparent)]'
                      : 'border-border hover:border-muted-foreground/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                      form.shippingMethod === value ? 'border-[var(--color-brand)]' : 'border-muted-foreground'
                    )}
                  >
                    {form.shippingMethod === value && (
                      <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => { setError(null); createShipment.mutate() }}
              disabled={createShipment.isPending || !form.destinationHub}
            >
              {createShipment.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
              ) : (
                'Open Shipment'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
