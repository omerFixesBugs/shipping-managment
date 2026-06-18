import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ImagePlus, Loader2, Package, Plus, Ship, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { HUB_LABELS, PRE_TRANSIT_STATUSES } from '@/lib/constants'
import { sumLineTotals, wouldExceedCapacity } from '@/lib/shipmentCapacity'
import type { Client, HubType, InventoryStatus, Shipment, ShipmentItem, WarehouseInventory } from '@/types/database'
import { BdWarehouseStoragePage } from '@/pages/warehouse/BdWarehouseStoragePage'

export function WarehouseStoragePage() {
  const { profile } = useAuth()
  if (profile?.hub === 'bangladesh') return <BdWarehouseStoragePage />
  return <OriginWarehouseStoragePage />
}

function OriginWarehouseStoragePage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const hub = (profile?.hub ?? 'dubai') as HubType
  const [tab, setTab] = useState<InventoryStatus>('in_storage')
  const [addOpen, setAddOpen] = useState(false)
  const [shipOpen, setShipOpen] = useState(false)
  const [weightEdit, setWeightEdit] = useState<WarehouseInventory | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: items, isLoading } = useQuery({
    queryKey: ['warehouse-inventory', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_inventory')
        .select('*, clients(name), shipments(reference_code)')
        .eq('hub', hub)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as WarehouseInventory[]
    },
    enabled: !!profile?.hub,
  })

  const { data: openShipments } = useQuery({
    queryKey: ['open-shipments', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('id, reference_code, status, container_name, destination_hub, weight_kg, volume_cbm, max_item_quantity')
        .eq('origin_hub', hub)
        .in('status', PRE_TRANSIT_STATUSES)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Pick<
        Shipment,
        'id' | 'reference_code' | 'status' | 'container_name' | 'destination_hub' | 'weight_kg' | 'volume_cbm' | 'max_item_quantity'
      >[]
    },
    enabled: !!profile?.hub,
  })

  const hasOpenShipments = (openShipments?.length ?? 0) > 0

  const visible = (items ?? []).filter((i) => i.status === tab)
  const selectedItems = (items ?? []).filter(
    (i) => selected.has(i.id) && i.status === 'in_storage' && !i.shipment_id
  )

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{HUB_LABELS[hub]} Storage</h2>
          <p className="text-xs text-muted-foreground">Products stored at this hub. Assign to a shipment — they stay here until that shipment ships.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'in_storage' && (
            <Button
              variant="outline"
              disabled={!hasOpenShipments || selectedItems.length === 0}
              title={
                !hasOpenShipments
                  ? 'Create a shipment first (Shipments → New Shipment)'
                  : selectedItems.length === 0
                    ? 'Select products to add'
                    : undefined
              }
              onClick={() => setShipOpen(true)}
            >
              <Ship className="h-4 w-4" />
              Add to Shipment
              {selectedItems.length > 0 ? ` (${selectedItems.length})` : ''}
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {([
              { id: 'in_storage', label: 'In Storage' },
              { id: 'shipped', label: 'Shipped' },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {tab === 'in_storage' ? 'No products in storage. Add one to get started.' : 'No shipped products yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-sm',
                    selected.has(item.id) && 'ring-2 ring-[var(--hub)]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {tab === 'in_storage' && !item.shipment_id && (
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--hub)]"
                      />
                    )}
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt={item.name} className="h-14 w-14 shrink-0 rounded-md border object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.name}</p>
                      {tab === 'in_storage' && item.shipment_id && (
                        <Link
                          to={`/warehouse/shipments/${item.shipment_id}`}
                          className="text-[10px] font-medium text-[var(--hub)] hover:underline"
                        >
                          Reserved → {item.shipments?.reference_code ?? 'shipment'}
                        </Link>
                      )}
                      {!item.weight_kg && tab === 'in_storage' && !item.shipment_id && (
                        <span className="text-[10px] font-medium text-amber-600">Weight required before ship</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} {item.unit ?? 'pcs'}
                        {item.weight_kg != null ? ` · ${item.weight_kg} kg` : ''}
                        {item.clients?.name ? ` · ${item.clients.name}` : ''}
                      </p>
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--hub)] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Source
                        </a>
                      )}
                    </div>
                  </div>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                  {tab === 'in_storage' && item.shipment_id && (
                    <Button asChild size="sm" variant="outline" className="mt-auto">
                      <Link to={`/warehouse/shipments/${item.shipment_id}`}>
                        View shipment ({item.shipments?.reference_code})
                      </Link>
                    </Button>
                  )}
                  {tab === 'in_storage' && !item.weight_kg && !item.shipment_id && (
                    <Button size="sm" variant="outline" className="mt-auto" onClick={() => setWeightEdit(item)}>
                      Set weight
                    </Button>
                  )}
                  {tab === 'shipped' && item.shipment_id && (
                    <Button asChild size="sm" variant="outline" className="mt-auto">
                      <Link to={`/warehouse/shipments/${item.shipment_id}`}>View shipment</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <AddInventoryDialog open={addOpen} onOpenChange={setAddOpen} hub={hub} />
      <AddToShipmentDialog
        open={shipOpen}
        onOpenChange={setShipOpen}
        hub={hub}
        items={selectedItems}
        openShipments={openShipments ?? []}
        onDone={() => {
          setSelected(new Set())
          queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', hub] })
          queryClient.invalidateQueries({ queryKey: ['warehouse-shipments-list'] })
          queryClient.invalidateQueries({ queryKey: ['open-shipments', hub] })
        }}
      />
      <EditWeightDialog
        item={weightEdit}
        onOpenChange={(o) => !o && setWeightEdit(null)}
        onSaved={() => {
          setWeightEdit(null)
          queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', hub] })
        }}
      />
    </div>
  )
}

function EditWeightDialog({
  item, onOpenChange, onSaved,
}: {
  item: WarehouseInventory | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [weightKg, setWeightKg] = useState('')
  const [volumeCbm, setVolumeCbm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      setWeightKg(item.weight_kg != null ? String(item.weight_kg) : '')
      setVolumeCbm(item.volume_cbm != null ? String(item.volume_cbm) : '')
      setError(null)
    }
  }, [item])

  const save = useMutation({
    mutationFn: async () => {
      if (!item || !weightKg || Number(weightKg) <= 0) throw new Error('Weight (kg) required')
      const { error } = await supabase
        .from('warehouse_inventory')
        .update({
          weight_kg: Number(weightKg),
          volume_cbm: volumeCbm ? Number(volumeCbm) : null,
        })
        .eq('id', item.id)
      if (error) throw error
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof Error ? err.message : 'Save failed'),
  })

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set weight — {item?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Total Weight (kg)</Label>
            <Input type="number" min={0} step="0.01" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Volume (CBM)</Label>
            <Input type="number" min={0} step="0.001" value={volumeCbm} onChange={(e) => setVolumeCbm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" disabled={save.isPending} onClick={() => { setError(null); save.mutate() }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AddToShipmentDialog({
  open, onOpenChange, hub, items, openShipments, onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  hub: HubType
  items: WarehouseInventory[]
  openShipments: Pick<
    Shipment,
    'id' | 'reference_code' | 'status' | 'container_name' | 'destination_hub' | 'weight_kg' | 'volume_cbm' | 'max_item_quantity'
  >[]
  onDone: () => void
}) {
  const { user } = useAuth()
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      const drafts: Record<string, string> = {}
      for (const it of items) {
        if (it.weight_kg == null || it.weight_kg <= 0) {
          drafts[it.id] = ''
        }
      }
      setWeightDrafts(drafts)
    }
  }, [open, items])

  useEffect(() => {
    if (open && openShipments.length && !target) {
      setTarget(openShipments[0].id)
    }
  }, [open, openShipments, target])

  const resolvedItems = items.map((it) => {
    const draft = weightDrafts[it.id]
    const weight =
      it.weight_kg != null && it.weight_kg > 0
        ? it.weight_kg
        : draft && Number(draft) > 0
          ? Number(draft)
          : null
    return { ...it, weight_kg: weight }
  })

  const selectedShipment = openShipments.find((s) => s.id === target)

  const { data: existingItems } = useQuery({
    queryKey: ['shipment-items', target],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_items')
        .select('quantity, weight_kg, volume_cbm')
        .eq('shipment_id', target)
      if (error) throw error
      return data as Pick<ShipmentItem, 'quantity' | 'weight_kg' | 'volume_cbm'>[]
    },
    enabled: open && !!target,
  })

  const adding = sumLineTotals(resolvedItems)
  const current = sumLineTotals(existingItems ?? [])
  const limits = {
    maxWeight: selectedShipment?.weight_kg,
    maxVolume: selectedShipment?.volume_cbm,
    maxQty: selectedShipment?.max_item_quantity,
  }
  const capacityError = wouldExceedCapacity(limits, current, adding)
  const missingWeight = resolvedItems.some((i) => i.weight_kg == null || i.weight_kg <= 0)
  const needsWeightInput = items.some((i) => i.weight_kg == null || i.weight_kg <= 0)

  const submit = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error('No products selected')
      if (!target) throw new Error('Select a shipment')
      if (missingWeight) throw new Error('Enter weight (kg) for every product')
      if (capacityError) throw capacityError

      for (const it of resolvedItems) {
        if (it.weight_kg != null && it.weight_kg > 0) {
          const { error: weightErr } = await supabase
            .from('warehouse_inventory')
            .update({ weight_kg: it.weight_kg })
            .eq('id', it.id)
          if (weightErr) throw weightErr
        }
      }

      const rows = resolvedItems.map((it) => ({
        shipment_id: target,
        name: it.name,
        quantity: it.quantity,
        unit: it.unit ?? 'pcs',
        weight_kg: it.weight_kg,
        volume_cbm: it.volume_cbm,
        source_url: it.source_url,
        images: it.images ?? [],
        client_id: it.client_id,
        created_by: user!.id,
      }))
      const { error: itemErr } = await supabase.from('shipment_items').insert(rows)
      if (itemErr) throw itemErr

      const { error: invErr } = await supabase
        .from('warehouse_inventory')
        .update({ shipment_id: target })
        .in('id', items.map((i) => i.id))
      if (invErr) throw invErr
    },
    onSuccess: () => {
      setTarget('')
      setWeightDrafts({})
      onOpenChange(false)
      onDone()
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to add to shipment'),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTarget(''); setWeightDrafts({}); setError(null) } onOpenChange(o) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {items.length} product(s) to shipment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {openShipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open shipments at {HUB_LABELS[hub]}. Create one under <strong>Shipments → New Shipment</strong> first.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>In-process shipment</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue placeholder="Select shipment" /></SelectTrigger>
                  <SelectContent>
                    {openShipments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.reference_code}
                        {s.container_name ? ` · ${s.container_name}` : ''}
                        {s.destination_hub ? ` → ${HUB_LABELS[s.destination_hub]}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedShipment && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">Capacity</p>
                  <div className="grid grid-cols-3 gap-2">
                    <CapacityBar
                      label="Weight (kg)"
                      used={current.weight + adding.weight}
                      max={selectedShipment.weight_kg}
                    />
                    <CapacityBar
                      label="Volume (CBM)"
                      used={current.volume + adding.volume}
                      max={selectedShipment.volume_cbm}
                    />
                    <CapacityBar
                      label="Items (pcs)"
                      used={current.quantity + adding.quantity}
                      max={selectedShipment.max_item_quantity}
                    />
                  </div>
                </div>
              )}

              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-2 text-sm">
                {items.map((it) => {
                  const hasWeight = it.weight_kg != null && it.weight_kg > 0
                  return (
                    <div key={it.id} className="rounded-md border bg-background p-2">
                      <div className="flex justify-between gap-2">
                        <span className="truncate font-medium">
                          {it.name}
                          {it.clients?.name ? ` · ${it.clients.name}` : ''}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {it.quantity} {it.unit ?? 'pcs'}
                        </span>
                      </div>
                      {hasWeight ? (
                        <p className="mt-1 text-xs text-muted-foreground">{it.weight_kg} kg</p>
                      ) : (
                        <div className="mt-2 space-y-1">
                          <Label className="text-xs text-amber-700 dark:text-amber-400">
                            Weight (kg) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Required before shipping"
                            value={weightDrafts[it.id] ?? ''}
                            onChange={(e) =>
                              setWeightDrafts((prev) => ({ ...prev, [it.id]: e.target.value }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {needsWeightInput && (
                <p className="text-xs text-muted-foreground">
                  Enter total weight for each product above. Saved to storage when added to shipment.
                </p>
              )}
              {capacityError && (
                <p className="text-sm text-red-500">{capacityError}</p>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => { setError(null); submit.mutate() }}
              disabled={submit.isPending || !target || !!capacityError || missingWeight}
            >
              {submit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : 'Add to Shipment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CapacityBar({ label, used, max }: { label: string; used: number; max: number | null | undefined }) {
  if (max == null || max <= 0) {
    return (
      <div>
        <p className="text-muted-foreground">{label}</p>
        <p className="font-medium">{used.toFixed(max != null && label.includes('CBM') ? 3 : 1)} used</p>
        <p className="text-[10px] text-muted-foreground">No limit set</p>
      </div>
    )
  }
  const pct = Math.min(100, (used / max) * 100)
  const over = used > max
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('font-medium tabular-nums', over && 'text-red-600')}>
        {used.toFixed(label.includes('CBM') ? 3 : 1)} / {max}
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', over ? 'bg-red-500' : 'bg-[var(--hub)]')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function AddInventoryDialog({
  open, onOpenChange, hub,
}: { open: boolean; onOpenChange: (o: boolean) => void; hub: HubType }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '', quantity: '1', unit: 'pcs', weightKg: '', volumeCbm: '', clientId: '', sourceUrl: '', notes: '',
  })
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return data as Pick<Client, 'id' | 'name'>[]
    },
    enabled: open,
  })

  function reset() {
    setForm({ name: '', quantity: '1', unit: 'pcs', weightKg: '', volumeCbm: '', clientId: '', sourceUrl: '', notes: '' })
    setImages([])
    setError(null)
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '3600', upsert: false })
        if (error) throw error
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      setImages((prev) => [...prev, ...uploaded])
    } catch (err) {
      setError(`Image upload failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.weightKg || Number(form.weightKg) <= 0) {
        throw new Error('Weight (kg) is required for storage products')
      }
      const { error } = await supabase.from('warehouse_inventory').insert({
        hub,
        client_id: form.clientId || null,
        name: form.name,
        quantity: Number(form.quantity) || 1,
        unit: form.unit || 'pcs',
        weight_kg: Number(form.weightKg),
        volume_cbm: form.volumeCbm ? Number(form.volumeCbm) : null,
        notes: form.notes || null,
        source_url: form.sourceUrl || null,
        images,
        added_by: user!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', hub] })
      reset()
      onOpenChange(false)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to add product'),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Product to {HUB_LABELS[hub]} Storage</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Total Weight (kg) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Required for shipping"
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Volume (CBM) <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input
                type="number"
                min={0}
                step="0.001"
                value={form.volumeCbm}
                onChange={(e) => setForm({ ...form, volumeCbm: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Client <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Select value={form.clientId || '__none__'} onValueChange={(v) => setForm({ ...form, clientId: v === '__none__' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Input type="url" placeholder="https://supplier.com/product" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Images</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((url) => (
                <div key={url} className="group relative h-14 w-14 overflow-hidden rounded-md border">
                  <img src={url} alt="product" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:bg-accent">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                <span className="text-[9px]">Image</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }}
                />
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
            <Button onClick={() => { setError(null); save.mutate() }} disabled={save.isPending || !form.name}>
              {save.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Add Product'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
