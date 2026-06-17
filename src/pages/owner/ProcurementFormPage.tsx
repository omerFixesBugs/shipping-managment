import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
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
import {
  REQUEST_MODE_HINTS,
  REQUEST_MODE_LABELS,
  syncProductPricing,
  type ProductPricingInput,
} from '@/lib/productPricing'
import { cn, formatCurrency } from '@/lib/utils'
import type { Client, HubType, ProcurementItem, ProcurementRequest, ProcurementRequestMode, ProductPricing, ShipmentType } from '@/types/database'

export function ProcurementFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()
  const basePath = profile?.role === 'owner' ? '/owner/procurement' : '/warehouse/procurement'

  const [title, setTitle] = useState('')
  const [targetHub, setTargetHub] = useState<HubType>('dubai')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ProcurementItem[]>([{ name: '', quantity: 1, unit: 'pcs' }])
  // String buffer for quantity inputs so typing isn't trapped by Number() coercion
  const [qtyStrings, setQtyStrings] = useState<string[]>(['1'])
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [clientId, setClientId] = useState('')
  const [shipmentType, setShipmentType] = useState<ShipmentType>('client_owned')
  const [requestMode, setRequestMode] = useState<ProcurementRequestMode>('sourced')
  const [itemPricing, setItemPricing] = useState<Record<number, { purchaseCost: string; clientPrice: string; advanceAmount: string }>>({})
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: clientsList } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return data as Client[]
    },
  })

  const { data: request } = useQuery({
    queryKey: ['procurement-request', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*), clients(name)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as ProcurementRequest
    },
    enabled: !isNew,
  })

  const { data: productPricing } = useQuery({
    queryKey: ['product-pricing', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_pricing').select('*').eq('request_id', id!)
      if (error) throw error
      return data as ProductPricing[]
    },
    enabled: !isNew && profile?.role === 'owner',
  })

  useEffect(() => {
    if (request?.client_id) setSelectedClientId(request.client_id)
  }, [request?.client_id])

  const buildPricingInputs = (): ProductPricingInput[] =>
    items.map((item, itemIndex) => ({
      itemIndex,
      productName: item.name,
      purchaseCost: itemPricing[itemIndex]?.purchaseCost
        ? Number(itemPricing[itemIndex].purchaseCost)
        : null,
      clientPrice: Number(itemPricing[itemIndex]?.clientPrice || item.expectedSellingPrice || 0),
      advanceAmount: Number(itemPricing[itemIndex]?.advanceAmount || 0),
    }))

  const updateItem = (index: number, patch: Partial<ProcurementItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const setQty = (index: number, raw: string) => {
    setQtyStrings((prev) => prev.map((v, i) => (i === index ? raw : v)))
    const n = parseInt(raw, 10)
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity: isNaN(n) ? 0 : n } : it))
    )
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
      const fullPayload = {
        owner_id: user!.id,
        title,
        target_hub: targetHub,
        items,
        notes: notes || null,
        status,
        client_id: clientId || null,
        shipment_type: shipmentType,
        request_mode: requestMode,
        requested_by: user!.id,
      }

      if (isNew) {
        const { data, error } = await supabase
          .from('procurement_requests')
          .insert(fullPayload)
          .select()
          .single()
        if (error) {
          if (error.message?.includes('column')) {
            throw new Error('Database is missing the new procurement columns. Run the pending migrations (supabase db push) or apply the SQL, then retry.')
          }
          throw error
        }

        if (status === 'sent') {
          await supabase.functions.invoke('shipment-status', {
            body: { type: 'procurement_status', requestId: data!.id, newStatus: 'sent' },
          })
        }
        if (profile?.role === 'owner') {
          await syncProductPricing(data!.id, clientId || null, items, buildPricingInputs())
        }
        return data
      }

      const { error } = await supabase
        .from('procurement_requests')
        .update(fullPayload)
        .eq('id', id!)
      if (error) throw error
      if (profile?.role === 'owner') {
        await syncProductPricing(id!, clientId || null, items, buildPricingInputs())
      }
      if (status === 'sent') {
        await supabase.functions.invoke('shipment-status', {
          body: { type: 'procurement_status', requestId: id, newStatus: 'sent' },
        })
      }
    },
    onSuccess: () => {
      setSaveError(null)
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      queryClient.invalidateQueries({ queryKey: ['bd-procurement-requests'] })
      navigate(basePath)
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : 'Failed to save request')
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

      if (action === 'approved' && request) {
        const inputs = buildPricingInputs().map((p) => {
          if (!p.purchaseCost && quote) {
            return { ...p, purchaseCost: Number(quote.total_cost) / Math.max(request.items.length, 1) }
          }
          return p
        })
        await syncProductPricing(id!, request.client_id, request.items, inputs)

        const totalAdvance = inputs.reduce((s, p) => s + (p.advanceAmount || 0), 0)
        if (totalAdvance > 0) {
          await supabase.from('financial_entries').insert({
            shipment_id: null,
            procurement_request_id: id,
            category: 'advance_payment',
            amount: totalAdvance,
            currency: 'USD',
            description: `Client advance: ${request.title}`,
            entry_date: new Date().toISOString().split('T')[0],
            created_by: user!.id,
          })
        }
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
      const assignedClientId = selectedClientId || request?.client_id || clientsList?.[0]?.id
      if (!assignedClientId) throw new Error('No clients found. Please create a client first under Clients.')

      const { data, error } = await supabase
        .from('shipments')
        .insert({
          client_id: assignedClientId,
          type: request?.shipment_type ?? 'business_sourced',
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
    const modeLabel = REQUEST_MODE_LABELS[request.request_mode ?? 'sourced']
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <p><span className="font-medium text-muted-foreground">Hub</span><br />{HUB_LABELS[request.target_hub]}</p>
              <p><span className="font-medium text-muted-foreground">Client</span><br />{request.clients?.name ?? '—'}</p>
              <p><span className="font-medium text-muted-foreground">Type</span><br />
                {request.shipment_type === 'client_owned' ? 'Client-Owned' : 'Business-Sourced'}
              </p>
              <p><span className="font-medium text-muted-foreground">Request Mode</span><br />{modeLabel}</p>
              {request.notes && (
                <p className="col-span-2"><span className="font-medium text-muted-foreground">Notes</span><br />{request.notes}</p>
              )}
            </div>

            <div className="space-y-3">
              {request.items.map((item, i) => (
                <ItemSummary key={i} item={item} />
              ))}
            </div>

            {quote && request.request_mode !== 'direct_buy' && (
              <div className="rounded-lg border p-4">
                <p className="font-medium">Quote: {formatCurrency(quote.total_cost, quote.currency)}</p>
                <p className="text-sm text-muted-foreground">{quote.notes}</p>
              </div>
            )}

            {profile?.role === 'owner' && productPricing && productPricing.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner Pricing</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2">Product</th>
                      <th className="pb-2 text-right">Buy</th>
                      <th className="pb-2 text-right">Sell</th>
                      <th className="pb-2 text-right">Margin</th>
                      <th className="pb-2 text-right">Advance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productPricing.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{p.product_name}</td>
                        <td className="py-2 text-right">{p.purchase_cost != null ? formatCurrency(p.purchase_cost, p.currency) : '—'}</td>
                        <td className="py-2 text-right">{formatCurrency(p.client_price, p.currency)}</td>
                        <td className="py-2 text-right font-semibold text-emerald-600">
                          {p.purchase_cost != null ? formatCurrency(p.client_price - p.purchase_cost, p.currency) : '—'}
                        </td>
                        <td className="py-2 text-right">{p.advance_amount > 0 ? formatCurrency(p.advance_amount, p.currency) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {request.status === 'quoted' && request.request_mode !== 'direct_buy' && (
              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <p className="text-sm text-muted-foreground">Set client price and record any advance before approving.</p>
                {request.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 text-sm">
                    <span className="col-span-3 font-medium">{item.name}</span>
                    <div>
                      <Label className="text-xs">Buy price</Label>
                      <Input
                        type="number"
                        value={itemPricing[i]?.purchaseCost ?? ''}
                        onChange={(e) => setItemPricing({ ...itemPricing, [i]: { purchaseCost: e.target.value, clientPrice: itemPricing[i]?.clientPrice ?? String(item.expectedSellingPrice ?? ''), advanceAmount: itemPricing[i]?.advanceAmount ?? '' } })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Client price</Label>
                      <Input
                        type="number"
                        value={itemPricing[i]?.clientPrice ?? String(item.expectedSellingPrice ?? '')}
                        onChange={(e) => setItemPricing({ ...itemPricing, [i]: { purchaseCost: itemPricing[i]?.purchaseCost ?? '', clientPrice: e.target.value, advanceAmount: itemPricing[i]?.advanceAmount ?? '' } })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Advance</Label>
                      <Input
                        type="number"
                        value={itemPricing[i]?.advanceAmount ?? ''}
                        onChange={(e) => setItemPricing({ ...itemPricing, [i]: { purchaseCost: itemPricing[i]?.purchaseCost ?? '', clientPrice: itemPricing[i]?.clientPrice ?? '', advanceAmount: e.target.value } })}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button onClick={() => approveQuote.mutate('approved')}>Approve</Button>
                  <Button variant="destructive" onClick={() => approveQuote.mutate('rejected')}>Reject</Button>
                </div>
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
                          value={selectedClientId || request.client_id || clientsList[0].id}
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
                    {createError && <p className="text-sm text-red-500">{createError}</p>}
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
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <h2 className="text-xl font-bold shrink-0">New Procurement Request</h2>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] gap-4 overflow-hidden">

        {/* ── Left: settings ── */}
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="flex flex-col gap-5 overflow-y-auto p-5">

            <FormSection title="Request Type">
              <div className="space-y-2">
                {(['sourced', 'direct_buy'] as const).map((mode) => (
                  <label key={mode} className="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
                    <input
                      type="radio"
                      name="requestMode"
                      checked={requestMode === mode}
                      onChange={() => setRequestMode(mode)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold">{REQUEST_MODE_LABELS[mode]}</p>
                      <p className="text-xs text-muted-foreground">{REQUEST_MODE_HINTS[mode]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </FormSection>

            <FormSection title="Request Info">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Target Hub</Label>
                <Select value={targetHub} onValueChange={(v) => setTargetHub(v as HubType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGIN_HUBS.map((h) => (
                      <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </FormSection>

            <FormSection title="Client & Shipment Type">
              <div className="space-y-1.5">
                <Label>Client <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Select
                  value={clientId || '__none__'}
                  onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None — multi-client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {clientsList?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Products tracked under this client.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Shipment Type</Label>
                <div className="flex flex-col gap-2 pt-0.5">
                  {(
                    [
                      { value: 'client_owned', label: 'Client-Owned' },
                      { value: 'business_sourced', label: 'Business-Sourced' },
                    ] as const
                  ).map(({ value, label }) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2">
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          shipmentType === value
                            ? 'border-[var(--color-brand)]'
                            : 'border-muted-foreground'
                        )}
                      >
                        {shipmentType === value && (
                          <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
                        )}
                      </span>
                      <input
                        type="radio"
                        name="proc-shipmentType"
                        value={value}
                        checked={shipmentType === value}
                        onChange={() => setShipmentType(value)}
                        className="sr-only"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </FormSection>

          </CardContent>
        </Card>

        {/* ── Right: products + footer ── */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3 shrink-0">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
              Products
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setItems([...items, { name: '', quantity: 1, unit: 'pcs' }])
                setQtyStrings([...qtyStrings, '1'])
              }}
            >
              + Add Product
            </Button>
          </div>

          {/* Scrollable product list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-3">

                  {/* name + qty + unit + remove */}
                  <div className="flex items-start gap-2">
                    <div className="flex flex-1 gap-2">
                      <Input
                        placeholder="Product name"
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                      />
                      <Input
                        type="number"
                        className="w-20"
                        value={qtyStrings[i] ?? String(item.quantity)}
                        onChange={(e) => setQty(i, e.target.value)}
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
                        onClick={() => {
                          setItems(items.filter((_, idx) => idx !== i))
                          setQtyStrings(qtyStrings.filter((_, idx) => idx !== i))
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>

                  {/* owner pricing — purchase cost hidden from BD */}
                  {profile?.role === 'owner' && (
                    <div className="grid grid-cols-2 gap-3 border-t pt-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Buy Price (USD)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Your cost"
                          value={itemPricing[i]?.purchaseCost ?? ''}
                          onChange={(e) =>
                            setItemPricing({
                              ...itemPricing,
                              [i]: { ...itemPricing[i], purchaseCost: e.target.value, clientPrice: itemPricing[i]?.clientPrice ?? '', advanceAmount: itemPricing[i]?.advanceAmount ?? '' },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Client Price (USD)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Charge client"
                          value={itemPricing[i]?.clientPrice ?? item.expectedSellingPrice ?? ''}
                          onChange={(e) =>
                            setItemPricing({
                              ...itemPricing,
                              [i]: { purchaseCost: itemPricing[i]?.purchaseCost ?? '', clientPrice: e.target.value, advanceAmount: itemPricing[i]?.advanceAmount ?? '' },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* deadline + selling price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Deadline <span className="font-normal">(optional)</span>
                      </Label>
                      <Input
                        type="date"
                        value={item.deadline ?? ''}
                        onChange={(e) => updateItem(i, { deadline: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Selling Price (USD) <span className="font-normal">(optional)</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={item.expectedSellingPrice ?? ''}
                        onChange={(e) =>
                          updateItem(i, {
                            expectedSellingPrice: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* source URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Source URL</Label>
                    <Input
                      type="url"
                      placeholder="https://supplier.com/product"
                      value={item.sourceUrl ?? ''}
                      onChange={(e) => updateItem(i, { sourceUrl: e.target.value })}
                    />
                  </div>

                  {/* images */}
                  <div className="flex flex-wrap gap-2">
                    {(item.images ?? []).map((url) => (
                      <div key={url} className="group relative h-14 w-14 overflow-hidden rounded-md border">
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
                    <label className="flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:bg-accent">
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
              ))}
            </div>
          </div>

          {/* Pinned footer */}
          <div className="border-t px-5 py-3 shrink-0 space-y-2">
            {saveError && (
              <p className="text-xs text-red-500">{saveError}</p>
            )}
            <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setSaveError(null); saveRequest.mutate('draft') }}
              disabled={saveRequest.isPending}
            >
              Save Draft
            </Button>
            <Button
              onClick={() => { setSaveError(null); saveRequest.mutate('sent') }}
              disabled={saveRequest.isPending}
            >
              {saveRequest.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                : 'Send to Hub'}
            </Button>
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function ItemSummary({ item }: { item: ProcurementItem }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
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

      {(item.deadline || item.expectedSellingPrice != null) && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {item.deadline && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Deadline: <span className="font-medium text-foreground">{item.deadline}</span>
            </span>
          )}
          {item.expectedSellingPrice != null && (
            <span>
              Expected price: <span className="font-medium text-foreground">{formatCurrency(item.expectedSellingPrice, 'USD')}</span>
            </span>
          )}
        </div>
      )}

      {item.images && item.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
