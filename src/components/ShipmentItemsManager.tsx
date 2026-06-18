import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { User } from 'lucide-react'
import {
  assignInventoryToShipment,
  releaseInventoryFromShipment,
  syncStorageWeightFromShipmentItem,
} from '@/lib/inventoryWeightSync'
import { sumLineTotals, wouldExceedCapacity } from '@/lib/shipmentCapacity'
import type { Client, HubType, ProcurementItem, ShipmentItem, WarehouseInventory } from '@/types/database'

const UNASSIGNED = '__none__'
const MANUAL = '__manual__'
const STORAGE_PREFIX = 'storage::'
const PROC_PREFIX = 'proc::'

interface ItemForm {
  name: string
  quantity: number
  unit: string
  weight_kg: string
  notes: string
  source_url: string
  images: string[]
  client_id: string
  procurement_request_id: string | null
  inventory_id: string | null
}

const EMPTY: ItemForm = {
  name: '',
  quantity: 1,
  unit: 'pcs',
  weight_kg: '',
  notes: '',
  source_url: '',
  images: [],
  client_id: UNASSIGNED,
  procurement_request_id: null,
  inventory_id: null,
}

type ReadyReq = { id: string; title: string; items: ProcurementItem[]; client_id: string | null }
type StorageItem = Pick<
  WarehouseInventory,
  'id' | 'name' | 'quantity' | 'unit' | 'weight_kg' | 'notes' | 'source_url' | 'images' | 'client_id'
>

function findStorageMatch(items: StorageItem[] | undefined, name: string) {
  const lower = name.trim().toLowerCase()
  return items?.find((i) => i.name.trim().toLowerCase() === lower)
}

export function ShipmentItemsManager({
  shipmentId,
  canEdit,
  originHub,
}: {
  shipmentId: string
  canEdit: boolean
  originHub?: HubType
}) {
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ShipmentItem | null>(null)
  const [form, setForm] = useState<ItemForm>(EMPTY)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pick, setPick] = useState<string>(MANUAL)

  const { data: items, isLoading } = useQuery({
    queryKey: ['shipment-items', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_items')
        .select('*, clients(name)')
        .eq('shipment_id', shipmentId)
        .order('created_at')
      if (error) throw error
      return data as ShipmentItem[]
    },
  })

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return data as Client[]
    },
    enabled: canEdit,
  })

  const { data: shipmentLimits } = useQuery({
    queryKey: ['shipment-capacity-limits', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('weight_kg, volume_cbm, max_item_quantity')
        .eq('id', shipmentId)
        .single()
      if (error) throw error
      return data
    },
    enabled: canEdit,
  })

  const { data: storageItems } = useQuery({
    queryKey: ['warehouse-inventory-in-storage', originHub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_inventory')
        .select('id, name, quantity, unit, weight_kg, notes, source_url, images, client_id')
        .eq('hub', originHub!)
        .eq('status', 'in_storage')
        .is('shipment_id', null)
        .order('name')
      if (error) throw error
      return data as StorageItem[]
    },
    enabled: canEdit && !!originHub,
  })

  const { data: readyReqs } = useQuery({
    queryKey: ['ready-to-ship-procurement', originHub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('id, title, items, client_id')
        .eq('target_hub', originHub!)
        .eq('status', 'ready_to_ship')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as ReadyReq[]
    },
    enabled: canEdit && !!originHub,
  })

  const readyOptions = (readyReqs ?? []).flatMap((req) =>
    req.items.map((it, idx) => ({
      key: `${PROC_PREFIX}${req.id}::${idx}`,
      reqId: req.id,
      clientId: req.client_id,
      label: `${it.name} (${it.quantity} ${it.unit ?? 'pcs'}) — ${req.title}`,
      item: it,
    }))
  )

  const applyStorageItem = (inv: StorageItem) => {
    setForm({
      name: inv.name,
      quantity: Number(inv.quantity) || 1,
      unit: inv.unit ?? 'pcs',
      weight_kg: inv.weight_kg != null && inv.weight_kg > 0 ? String(inv.weight_kg) : '',
      notes: inv.notes ?? '',
      source_url: inv.source_url ?? '',
      images: inv.images ?? [],
      client_id: inv.client_id ?? UNASSIGNED,
      procurement_request_id: null,
      inventory_id: inv.id,
    })
  }

  const applyPick = (key: string) => {
    setPick(key)
    if (key === MANUAL) {
      setForm((f) => ({ ...EMPTY, client_id: f.client_id }))
      return
    }
    if (key.startsWith(STORAGE_PREFIX)) {
      const inv = storageItems?.find((i) => i.id === key.slice(STORAGE_PREFIX.length))
      if (inv) applyStorageItem(inv)
      return
    }
    const opt = readyOptions.find((o) => o.key === key)
    if (!opt) return
    const storageMatch = findStorageMatch(storageItems, opt.item.name)
    setForm({
      name: opt.item.name,
      quantity: opt.item.quantity ?? 1,
      unit: opt.item.unit ?? 'pcs',
      weight_kg:
        storageMatch?.weight_kg != null && storageMatch.weight_kg > 0
          ? String(storageMatch.weight_kg)
          : '',
      notes: opt.item.notes ?? '',
      source_url: opt.item.sourceUrl ?? '',
      images: opt.item.images ?? [],
      procurement_request_id: opt.reqId,
      client_id: opt.clientId ?? UNASSIGNED,
      inventory_id: storageMatch?.id ?? null,
    })
  }

  const openNew = () => {
    setEditing(null)
    setError(null)
    if (storageItems?.length) {
      applyStorageItem(storageItems[0])
      setPick(`${STORAGE_PREFIX}${storageItems[0].id}`)
    } else {
      setForm(EMPTY)
      setPick(MANUAL)
    }
    setOpen(true)
  }

  const openEdit = async (item: ShipmentItem) => {
    setEditing(item)
    setPick(MANUAL)

    let inventoryId: string | null = null
    let weightFromStorage = item.weight_kg

    const { data: linked } = await supabase
      .from('warehouse_inventory')
      .select('id, weight_kg')
      .eq('shipment_id', shipmentId)
      .eq('name', item.name)
      .maybeSingle()
    if (linked) {
      inventoryId = linked.id
      if ((weightFromStorage == null || weightFromStorage <= 0) && linked.weight_kg) {
        weightFromStorage = linked.weight_kg
      }
    } else if (originHub) {
      const storageMatch = findStorageMatch(storageItems, item.name)
      if (storageMatch) {
        inventoryId = storageMatch.id
        if ((weightFromStorage == null || weightFromStorage <= 0) && storageMatch.weight_kg) {
          weightFromStorage = storageMatch.weight_kg
        }
      }
    }

    setForm({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit ?? 'pcs',
      weight_kg: weightFromStorage != null && weightFromStorage > 0 ? String(weightFromStorage) : '',
      notes: item.notes ?? '',
      source_url: item.source_url ?? '',
      images: item.images ?? [],
      client_id: item.client_id ?? UNASSIGNED,
      procurement_request_id: item.procurement_request_id,
      inventory_id: inventoryId,
    })
    setError(null)
    setOpen(true)
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('product-images').upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }))
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Product name required')
      if (!form.weight_kg || Number(form.weight_kg) <= 0) throw new Error('Weight (kg) is required')

      const payload = {
        shipment_id: shipmentId,
        name: form.name.trim(),
        quantity: form.quantity,
        unit: form.unit || null,
        weight_kg: Number(form.weight_kg),
        volume_cbm: null as number | null,
        notes: form.notes || null,
        source_url: form.source_url || null,
        images: form.images,
        client_id: form.client_id === UNASSIGNED ? null : form.client_id,
        procurement_request_id: form.procurement_request_id,
      }

      const others = (items ?? []).filter((i) => i.id !== editing?.id)
      const current = sumLineTotals(others)
      const adding = sumLineTotals([payload])
      const capErr = wouldExceedCapacity(
        {
          maxWeight: shipmentLimits?.weight_kg,
          maxVolume: shipmentLimits?.volume_cbm,
          maxQty: shipmentLimits?.max_item_quantity,
        },
        current,
        adding
      )
      if (capErr) throw new Error(capErr)

      if (editing) {
        const { error } = await supabase.from('shipment_items').update(payload).eq('id', editing.id)
        if (error) throw error
        await syncStorageWeightFromShipmentItem({
          weight_kg: payload.weight_kg,
          productName: payload.name,
          shipmentId,
          originHub,
          inventoryId: form.inventory_id,
        })
      } else {
        const { error } = await supabase
          .from('shipment_items')
          .insert({ ...payload, created_by: user!.id })
        if (error) throw error

        const storageMatch = form.inventory_id
          ? storageItems?.find((i) => i.id === form.inventory_id)
          : findStorageMatch(storageItems, payload.name)

        if (storageMatch || form.inventory_id) {
          await assignInventoryToShipment({
            weight_kg: payload.weight_kg,
            productName: payload.name,
            shipmentId,
            originHub,
            inventoryId: form.inventory_id ?? storageMatch?.id,
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-items', shipmentId] })
      if (originHub) {
        queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', originHub] })
        queryClient.invalidateQueries({ queryKey: ['warehouse-inventory-in-storage', originHub] })
      }
      setOpen(false)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Save failed'),
  })

  const remove = useMutation({
    mutationFn: async (itemId: string) => {
      const item = items?.find((i) => i.id === itemId)
      const { error } = await supabase.from('shipment_items').delete().eq('id', itemId)
      if (error) throw error
      if (item) {
        await releaseInventoryFromShipment({
          shipmentId,
          productName: item.name,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-items', shipmentId] })
      if (originHub) {
        queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', originHub] })
        queryClient.invalidateQueries({ queryKey: ['warehouse-inventory-in-storage', originHub] })
      }
    },
  })

  const weightFromStorage = Boolean(
    form.inventory_id &&
      storageItems?.find((i) => i.id === form.inventory_id)?.weight_kg != null &&
      storageItems.find((i) => i.id === form.inventory_id)!.weight_kg! > 0
  )

  const hasPickOptions = (storageItems?.length ?? 0) > 0 || readyOptions.length > 0

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground">Loading products…</p>}

      {items?.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No products added to this shipment yet.</p>
      )}

      <div className="space-y-2">
        {items?.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
            {item.images?.[0] ? (
              <a href={item.images[0]} target="_blank" rel="noopener noreferrer">
                <img src={item.images[0]} alt={item.name} className="h-12 w-12 rounded-md border object-cover" />
              </a>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                {item.quantity}
              </div>
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.name}</p>
                <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                {item.weight_kg != null && (
                  <span className="text-xs font-medium text-foreground">{item.weight_kg} kg</span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: 'var(--hub-soft)', color: 'var(--hub)' }}
                >
                  <User className="h-3 w-3" />
                  {item.clients?.name ?? 'Unassigned'}
                </span>
              </div>
              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
              {item.source_url && (
                <a
                  href={item.source_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--hub)' }}
                >
                  <ExternalLink className="h-3 w-3" /> Source
                </a>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {isOwner ? (
                  <PasswordConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    }
                    title="Delete Product"
                    description={`Remove "${item.name}" from this shipment? This cannot be undone.`}
                    actionLabel="Delete Product"
                    destructive
                    onConfirmed={() => remove.mutateAsync(item.id)}
                  />
                ) : (
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { if (confirm(`Remove "${item.name}" from shipment?`)) remove.mutate(item.id) }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <Button variant="outline" size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add Product
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate() }}
            className="space-y-4"
          >
            {!editing && hasPickOptions && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label>Add from</Label>
                <Select value={pick} onValueChange={applyPick}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {storageItems && storageItems.length > 0 && (
                      <SelectGroup>
                        {storageItems.map((inv) => (
                          <SelectItem key={inv.id} value={`${STORAGE_PREFIX}${inv.id}`}>
                            {inv.name} ({inv.quantity} {inv.unit ?? 'pcs'})
                            {inv.weight_kg ? ` · ${inv.weight_kg} kg` : ' · no weight yet'}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {readyOptions.length > 0 && (
                      <SelectGroup>
                        {readyOptions.map((o) => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    <SelectItem value={MANUAL}>Enter manually</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Pick from storage — product stays in storage until shipment is marked in transit. Weight syncs both ways.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Product Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  const match = findStorageMatch(storageItems, name)
                  setForm((f) => ({
                    ...f,
                    name,
                    inventory_id: match?.id ?? null,
                    weight_kg:
                      match?.weight_kg && match.weight_kg > 0
                        ? String(match.weight_kg)
                        : f.weight_kg,
                  }))
                }}
                required
                readOnly={!editing && !!form.inventory_id}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number" min={0} step="0.01" value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs / box / kg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total Weight (kg) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder={weightFromStorage ? 'Loaded from storage' : 'Enter weight — syncs to storage'}
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                required
              />
              {form.inventory_id && (
                <p className="text-[11px] text-muted-foreground">
                  {weightFromStorage
                    ? 'Weight loaded from storage. You can change it here and storage will update.'
                    : 'No weight in storage yet — set it here and it will save to storage.'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Images</Label>
              <div className="flex flex-wrap gap-2">
                {form.images.map((url) => (
                  <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-md border">
                    <img src={url} alt="product" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:bg-accent">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  <span className="text-[9px]">Image</span>
                  <input
                    type="file" accept="image/*" multiple className="hidden" disabled={uploading}
                    onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }}
                  />
                </label>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" disabled={save.isPending || uploading} className="w-full">
              {save.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
