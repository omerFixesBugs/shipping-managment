import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import { ORIGIN_HUBS, HUB_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { Client, HubType, ProcurementItem, ProcurementRequest } from '@/types/database'

export function ProcurementFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [targetHub, setTargetHub] = useState<HubType>('dubai')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ProcurementItem[]>([{ name: '', quantity: 1, unit: 'pcs' }])
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [createError, setCreateError] = useState<string | null>(null)

  const { data: request } = useQuery({
    queryKey: ['procurement-request', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as ProcurementRequest
    },
    enabled: !isNew,
  })

  const updateItem = (index: number, patch: Partial<ProcurementItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const handleUpload = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingIndex(index)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('product-images').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (error) throw error
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      setItems((prev) =>
        prev.map((it, i) =>
          i === index ? { ...it, images: [...(it.images ?? []), ...uploaded] } : it
        )
      )
    } catch (err) {
      alert(`Image upload failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploadingIndex(null)
    }
  }

  const removeImage = (index: number, url: string) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, images: (it.images ?? []).filter((u) => u !== url) } : it
      )
    )
  }

  const saveRequest = useMutation({
    mutationFn: async (status: 'draft' | 'sent') => {
      const payload = {
        owner_id: user!.id,
        title,
        target_hub: targetHub,
        items,
        notes: notes || null,
        status,
      }
      if (isNew) {
        const { data, error } = await supabase.from('procurement_requests').insert(payload).select().single()
        if (error) throw error
        if (status === 'sent') {
          await supabase.functions.invoke('shipment-status', {
            body: { type: 'procurement_status', requestId: data.id, newStatus: 'sent' },
          })
        }
        return data
      }
      const { error } = await supabase.from('procurement_requests').update(payload).eq('id', id!)
      if (error) throw error
      if (status === 'sent') {
        await supabase.functions.invoke('shipment-status', {
          body: { type: 'procurement_status', requestId: id, newStatus: 'sent' },
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      navigate('/owner/procurement')
    },
  })

  const approveQuote = useMutation({
    mutationFn: async (action: 'approved' | 'rejected') => {
      const { error: reqError } = await supabase
        .from('procurement_requests')
        .update({ status: action })
        .eq('id', id!)
      if (reqError) throw reqError

      const quote = request?.quotes?.[0]
      if (quote) {
        await supabase
          .from('quotes')
          .update({ status: action === 'approved' ? 'accepted' : 'rejected' })
          .eq('id', quote.id)
      }

      await supabase.functions.invoke('shipment-status', {
        body: { type: 'procurement_status', requestId: id, newStatus: action },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-request', id] })
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
    },
  })

  const { data: clientsList } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return data as Client[]
    },
    enabled: !isNew,
  })

  const { data: linkedShipment } = useQuery({
    queryKey: ['procurement-shipment', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('shipments')
        .select('id, reference_code')
        .eq('procurement_request_id', id!)
        .maybeSingle()
      return data as { id: string; reference_code: string } | null
    },
    enabled: !isNew,
  })

  const createShipment = useMutation({
    mutationFn: async () => {
      const clientId = selectedClientId || clientsList?.[0]?.id
      if (!clientId) throw new Error('No clients found. Please create a client first under Clients.')

      const { data, error } = await supabase
        .from('shipments')
        .insert({
          client_id: clientId,
          type: 'business_sourced',
          origin_hub: request!.target_hub,
          current_hub: request!.target_hub,
          description: request!.title,
          procurement_request_id: id,
          created_by: user!.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['procurement-shipment', id] })
      navigate(`/owner/shipments/${data.id}`)
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : 'Failed to create shipment')
    },
  })

  if (!isNew && request) {
    const quote = request.quotes?.[0]
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h2 className="text-2xl font-bold">{request.title}</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Request Details</CardTitle>
              <ProcurementStatusBadge status={request.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p><strong>Hub:</strong> {HUB_LABELS[request.target_hub]}</p>
            <p><strong>Notes:</strong> {request.notes ?? '—'}</p>
            <div className="space-y-3">
              {request.items.map((item, i) => (
                <ItemSummary key={i} item={item} />
              ))}
            </div>
            {quote && (
              <div className="rounded-lg border p-4">
                <p className="font-medium">Quote: {formatCurrency(quote.total_cost, quote.currency)}</p>
                <p className="text-sm text-muted-foreground">{quote.notes}</p>
              </div>
            )}
            {request.status === 'quoted' && (
              <div className="flex gap-2">
                <Button onClick={() => approveQuote.mutate('approved')}>Approve</Button>
                <Button variant="destructive" onClick={() => approveQuote.mutate('rejected')}>Reject</Button>
              </div>
            )}
            {request.status === 'ready_to_ship' && (
              <div className="rounded-lg border border-dashed p-4">
                {linkedShipment ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Goods are purchased and ready. A shipment has been created — track it below.
                    </p>
                    <Button variant="outline" onClick={() => navigate(`/owner/shipments/${linkedShipment.id}`)}>
                      View shipment {linkedShipment.reference_code}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Goods are purchased and ready at the {HUB_LABELS[request.target_hub]} hub.
                      Assign a client and create a shipment to start moving them to Bangladesh.
                    </p>
                    {clientsList && clientsList.length > 0 ? (
                      <div className="space-y-2">
                        <Label>Assign to Client</Label>
                        <Select
                          value={selectedClientId || clientsList[0].id}
                          onValueChange={setSelectedClientId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientsList.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">
                        No clients found. Please create a client first under the Clients section.
                      </p>
                    )}
                    {createError && (
                      <p className="text-sm text-red-500">{createError}</p>
                    )}
                    <Button
                      onClick={() => { setCreateError(null); createShipment.mutate() }}
                      disabled={createShipment.isPending || !clientsList?.length}
                    >
                      {createShipment.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                      ) : 'Create Shipment'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">New Procurement Request</h2>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Target Hub</Label>
            <Select value={targetHub} onValueChange={(v) => setTargetHub(v as HubType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGIN_HUBS.map((h) => (
                  <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Label>Products</Label>
            {items.map((item, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 gap-2">
                    <Input
                      placeholder="Product name"
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    />
                    <Input
                      placeholder="unit"
                      className="w-20"
                      value={item.unit ?? ''}
                      onChange={(e) => updateItem(i, { unit: e.target.value })}
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Source URL (where to buy / find online)</Label>
                  <Input
                    type="url"
                    placeholder="https://supplier.com/product"
                    value={item.sourceUrl ?? ''}
                    onChange={(e) => updateItem(i, { sourceUrl: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(item.images ?? []).map((url) => (
                      <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-md border">
                        <img src={url} alt="product" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i, url)}
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:bg-accent">
                      {uploadingIndex === i ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      <span className="text-[9px]">Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingIndex !== null}
                        onChange={(e) => {
                          handleUpload(i, e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems([...items, { name: '', quantity: 1, unit: 'pcs' }])}
            >
              Add Product
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => saveRequest.mutate('draft')}>Save Draft</Button>
            <Button onClick={() => saveRequest.mutate('sent')}>Send to Hub</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ItemSummary({ item }: { item: ProcurementItem }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">
          {item.name} — {item.quantity} {item.unit}
        </p>
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--hub)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Source
          </a>
        )}
      </div>
      {item.images && item.images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.images.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={item.name}
                className="h-16 w-16 rounded-md border object-cover transition-opacity hover:opacity-80"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
