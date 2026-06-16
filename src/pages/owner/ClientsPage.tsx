import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Package, ShoppingCart, Ship, Trash2, Warehouse } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { cn } from '@/lib/utils'
import { HUB_LABELS } from '@/lib/constants'
import type { Client, ProcurementItem, ProcurementRequest, WarehouseInventory } from '@/types/database'

interface ClientProduct {
  source: 'procurement' | 'storage' | 'shipment'
  /** Row id: inventory id | shipment_item id | procurement request id */
  id: string
  /** For procurement items: index into the request's items array + the full array. */
  itemIndex?: number
  allItems?: ProcurementItem[]
  name: string
  quantity: number
  unit: string | null
  sourceUrl?: string | null
  images?: string[]
  meta: string
}

export function ClientsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      return data as Client[]
    },
  })

  const createClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('clients').insert({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setOpen(false)
      setForm({ name: '', phone: '', email: '', address: '' })
    },
  })

  const selected = clients?.find((c) => c.id === selectedId) ?? clients?.[0] ?? null

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Clients</h2>
          <p className="text-xs text-muted-foreground">Select a client to see all products under their name.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Client</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createClient.mutate()
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Phone (E.164)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+88017..." />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <Button type="submit" disabled={createClient.isPending}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.4fr] gap-4 overflow-hidden">
        {/* ── Master: clients ── */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : !clients?.length ? (
              <p className="p-10 text-center text-sm text-muted-foreground">No clients yet.</p>
            ) : (
              <ul className="divide-y">
                {clients.map((c) => {
                  const isActive = selected?.id === c.id
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40',
                          isActive && 'bg-accent/50'
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* ── Detail: products under client ── */}
        <div className="overflow-y-auto">
          {selected ? (
            <ClientProductsPanel client={selected} />
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Select a client.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

const SOURCE_META: Record<ClientProduct['source'], { label: string; icon: typeof Package }> = {
  procurement: { label: 'Procurement', icon: ShoppingCart },
  storage: { label: 'In Storage', icon: Warehouse },
  shipment: { label: 'Shipment', icon: Ship },
}

function ClientProductsPanel({ client }: { client: Client }) {
  const queryClient = useQueryClient()
  const { data: products, isLoading } = useQuery({
    queryKey: ['client-products', client.id],
    queryFn: async () => {
      const list: ClientProduct[] = []

      const [procRes, invRes, itemRes] = await Promise.all([
        supabase
          .from('procurement_requests')
          .select('id, title, target_hub, status, items')
          .eq('client_id', client.id),
        supabase
          .from('warehouse_inventory')
          .select('id, name, quantity, unit, source_url, images, status, hub')
          .eq('client_id', client.id),
        supabase
          .from('shipment_items')
          .select('id, name, quantity, unit, source_url, images, shipments(reference_code)')
          .eq('client_id', client.id),
      ])

      for (const req of (procRes.data ?? []) as Pick<ProcurementRequest, 'id' | 'title' | 'target_hub' | 'status' | 'items'>[]) {
        ;(req.items ?? []).forEach((it, idx) => {
          list.push({
            source: 'procurement',
            id: req.id,
            itemIndex: idx,
            allItems: req.items,
            name: it.name,
            quantity: it.quantity,
            unit: it.unit ?? null,
            sourceUrl: it.sourceUrl,
            images: it.images,
            meta: `${req.title} · ${HUB_LABELS[req.target_hub]} · ${req.status}`,
          })
        })
      }

      for (const inv of (invRes.data ?? []) as Pick<WarehouseInventory, 'id' | 'name' | 'quantity' | 'unit' | 'source_url' | 'images' | 'status' | 'hub'>[]) {
        list.push({
          source: 'storage',
          id: inv.id,
          name: inv.name,
          quantity: inv.quantity,
          unit: inv.unit,
          sourceUrl: inv.source_url,
          images: inv.images,
          meta: `${HUB_LABELS[inv.hub]} · ${inv.status === 'shipped' ? 'Shipped' : 'In storage'}`,
        })
      }

      type ItemRow = {
        id: string
        name: string
        quantity: number
        unit: string | null
        source_url: string | null
        images: string[]
        shipments?: { reference_code: string } | { reference_code: string }[] | null
      }
      for (const item of (itemRes.data ?? []) as ItemRow[]) {
        const ship = Array.isArray(item.shipments) ? item.shipments[0] : item.shipments
        list.push({
          source: 'shipment',
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          sourceUrl: item.source_url,
          images: item.images,
          meta: ship?.reference_code ?? 'Shipment',
        })
      }

      return list
    },
  })

  const deleteProduct = async (p: ClientProduct) => {
    if (p.source === 'storage') {
      const { error } = await supabase.from('warehouse_inventory').delete().eq('id', p.id)
      if (error) throw error
    } else if (p.source === 'shipment') {
      const { error } = await supabase.from('shipment_items').delete().eq('id', p.id)
      if (error) throw error
    } else {
      // Procurement item lives inside the request's JSONB items array.
      const remaining = (p.allItems ?? []).filter((_, i) => i !== p.itemIndex)
      const { error } = await supabase
        .from('procurement_requests')
        .update({ items: remaining })
        .eq('id', p.id)
      if (error) throw error
    }
    queryClient.invalidateQueries({ queryKey: ['client-products', client.id] })
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-bold">{client.name}</h3>
          <p className="text-xs text-muted-foreground">
            {client.phone}{client.email ? ` · ${client.email}` : ''}{client.address ? ` · ${client.address}` : ''}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Products under this client
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !products?.length ? (
            <p className="rounded-md bg-muted px-3 py-3 text-sm text-muted-foreground">
              No products linked to this client yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {products.map((p, i) => {
                const Icon = SOURCE_META[p.source].icon
                return (
                  <li key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="h-12 w-12 shrink-0 rounded-md border object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{p.name}</p>
                        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                          {p.quantity} {p.unit ?? 'pcs'}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="h-3 w-3" />
                        <span className="truncate">{SOURCE_META[p.source].label} · {p.meta}</span>
                      </div>
                      {p.sourceUrl && (
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--hub)] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Source
                        </a>
                      )}
                    </div>
                    <PasswordConfirmDialog
                      trigger={
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          title="Delete product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      }
                      title="Delete product"
                      description={`Permanently delete "${p.name}"? This cannot be undone.`}
                      actionLabel="Delete"
                      destructive
                      onConfirmed={() => deleteProduct(p)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
