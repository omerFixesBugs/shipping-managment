import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, ImagePlus, Loader2, Package, Search, ShoppingBag, Trash2, User, X, Zap, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientPicker } from '@/components/ClientPicker'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import { OptionCardGroup } from '@/components/ui/option-card'
import { HubDestinationPicker } from '@/components/ui/hub-destination-picker'
import { DateField } from '@/components/ui/date-field'
import { PageHeader } from '@/components/ui/page-header'
import { ORIGIN_HUBS, HUB_LABELS } from '@/lib/constants'
import {
  REQUEST_MODE_HINTS,
  REQUEST_MODE_LABELS,
  type ProductPricingInput,
} from '@/lib/productPricing'
import { buildProductCostsFromQuote, type QuoteBreakdownLine } from '@/lib/quotePricing'
import {
  approveProcurementRequest,
  rejectProcurementRequest,
  upsertSingleProductPricing,
} from '@/lib/procurementApproval'
import { formatCurrency } from '@/lib/utils'
import type { Client, HubType, ProcurementItem, ProcurementRequest, ProcurementRequestMode, ProductPricing, ShipmentType } from '@/types/database'

export function ProcurementFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()
  const basePath = profile?.role === 'owner' ? '/owner/procurement' : '/warehouse/procurement'
  const returnTo = searchParams.get('return')
  const focusItemIndex = searchParams.has('item') ? Number(searchParams.get('item')) : null

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
  const [itemPricing, setItemPricing] = useState<Record<number, { clientPrice: string; advanceAmount: string }>>({})
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: clientsList } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, phone, email').order('name')
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

  useEffect(() => {
    if (!request || !productPricing?.length) return
    const next: Record<number, { clientPrice: string; advanceAmount: string }> = {}
    for (const p of productPricing) {
      next[p.item_index] = {
        clientPrice: p.client_price > 0 ? String(p.client_price) : '',
        advanceAmount: p.advance_amount > 0 ? String(p.advance_amount) : '',
      }
    }
    setItemPricing((prev) => ({ ...next, ...prev }))
  }, [request?.id, productPricing])

  const buildPricingInputs = (
    quoteBreakdown?: QuoteBreakdownLine[],
    quoteCurrency = 'USD'
  ): ProductPricingInput[] => {
    const costs = quoteBreakdown?.length
      ? buildProductCostsFromQuote(items.length ? items : request?.items ?? [], quoteBreakdown)
      : null
    const productItems = items.length ? items : request?.items ?? []
    return productItems.map((item, itemIndex) => ({
      itemIndex,
      productName: item.name,
      purchaseCost: costs ? costs[itemIndex]?.totalCost ?? null : null,
      clientPrice: Number(itemPricing[itemIndex]?.clientPrice || 0),
      advanceAmount: Number(itemPricing[itemIndex]?.advanceAmount || 0),
      currency: quoteCurrency,
    }))
  }

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
        return data
      }

      const { error } = await supabase
        .from('procurement_requests')
        .update(fullPayload)
        .eq('id', id!)
      if (error) throw error
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
      const quote = request?.quotes?.[0]
      if (action === 'rejected') {
        await rejectProcurementRequest(id!, quote?.id)
        return
      }
      const breakdown = (quote?.breakdown ?? []) as QuoteBreakdownLine[]
      const inputs = buildPricingInputs(breakdown, quote?.currency ?? 'USD')
      await approveProcurementRequest({
        requestId: id!,
        userId: user!.id,
        request: request!,
        quoteId: quote?.id,
        pricingInputs: inputs,
      })
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['procurement-request', id] })
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      queryClient.invalidateQueries({ queryKey: ['product-pricing', id] })
      if (returnTo && action === 'approved') {
        navigate(returnTo)
      }
    },
  })

  const saveProductPrice = useMutation({
    mutationFn: async (itemIndex: number) => {
      const quote = request?.quotes?.[0]
      if (!quote || !request) throw new Error('Missing quote')
      const breakdown = (quote.breakdown ?? []) as QuoteBreakdownLine[]
      const costs = buildProductCostsFromQuote(request.items, breakdown)[itemIndex]
      const price = Number(itemPricing[itemIndex]?.clientPrice || 0)
      if (!price || price <= 0) throw new Error('Enter a client price')
      await upsertSingleProductPricing(
        id!,
        request.client_id,
        request.items[itemIndex],
        itemIndex,
        {
          purchaseCost: costs?.totalCost ?? null,
          clientPrice: price,
          advanceAmount: Number(itemPricing[itemIndex]?.advanceAmount || 0),
          currency: quote.currency,
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-pricing', id] })
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      if (returnTo) navigate(returnTo)
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
      const assignedClientId = selectedClientId || request?.client_id
      if (!assignedClientId) throw new Error('Select a client before creating the shipment.')

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
    const itemLink = (index: number) => {
      const params = new URLSearchParams()
      params.set('item', String(index))
      if (returnTo) params.set('return', returnTo)
      return `/owner/procurement/${request.id}?${params.toString()}`
    }
    const visibleItemIndexes =
      focusItemIndex != null && !Number.isNaN(focusItemIndex)
        ? [focusItemIndex]
        : request.items.map((_, i) => i)

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {returnTo && (
          <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1" asChild>
            <Link to={returnTo}>
              <ArrowLeft className="h-4 w-4" /> Back to list
            </Link>
          </Button>
        )}
        <h2 className="text-2xl font-bold">{request.title}</h2>
        {focusItemIndex != null && request.items[focusItemIndex] && (
          <p className="text-sm text-muted-foreground">
            Managing product {focusItemIndex + 1} of {request.items.length}:{' '}
            <span className="font-medium text-foreground">{request.items[focusItemIndex].name}</span>
          </p>
        )}
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
                <div
                  key={i}
                  className={focusItemIndex === i ? 'rounded-lg ring-2 ring-[var(--color-brand)] ring-offset-2' : ''}
                >
                  <ItemSummary item={item} />
                </div>
              ))}
            </div>

            {request.items.length > 1 && focusItemIndex != null && (
              <div className="flex flex-wrap gap-2">
                {request.items.map((item, i) => (
                  <Button
                    key={i}
                    variant={focusItemIndex === i ? 'default' : 'outline'}
                    size="sm"
                    asChild
                  >
                    <Link to={itemLink(i)}>{item.name}</Link>
                  </Button>
                ))}
              </div>
            )}

            {quote && (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hub Quote — {formatCurrency(quote.total_cost, quote.currency)}
                </p>
                {(quote.breakdown as QuoteBreakdownLine[])?.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2">Line</th>
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Unit</th>
                        <th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quote.breakdown as QuoteBreakdownLine[]).map((b, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">
                            {b.item}
                            {b.type !== 'item' && (
                              <span className="ml-1 text-[10px] text-muted-foreground">({b.type})</span>
                            )}
                          </td>
                          <td className="py-2 text-right text-muted-foreground">{b.quantity}</td>
                          <td className="py-2 text-right text-muted-foreground">
                            {formatCurrency(b.unitPrice, quote.currency)}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {formatCurrency(b.cost, quote.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {quote.notes && <p className="text-sm text-muted-foreground">{quote.notes}</p>}
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

            {request.status === 'quoted' && quote && (
              <div className="space-y-4 rounded-lg border border-dashed p-4">
                <p className="text-sm text-muted-foreground">
                  Hub buy costs below are read-only. Set client price per product, then approve.
                </p>
                {request.items.map((item, i) => {
                  if (!visibleItemIndexes.includes(i)) return null
                  const breakdown = (quote.breakdown ?? []) as QuoteBreakdownLine[]
                  const costs = buildProductCostsFromQuote(request.items, breakdown)[i]
                  const clientPrice = Number(itemPricing[i]?.clientPrice || 0)
                  const margin = costs ? clientPrice - costs.totalCost : null
                  return (
                    <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <p className="font-semibold">{item.name}</p>
                      {costs && (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <dt className="text-muted-foreground">Product buy</dt>
                          <dd className="text-right font-data">{formatCurrency(costs.productCost, quote.currency)}</dd>
                          {costs.packagingCost > 0 && (
                            <>
                              <dt className="text-muted-foreground">Packaging</dt>
                              <dd className="text-right font-data">{formatCurrency(costs.packagingCost, quote.currency)}</dd>
                            </>
                          )}
                          {costs.shippingCost > 0 && (
                            <>
                              <dt className="text-muted-foreground">Freight</dt>
                              <dd className="text-right font-data">{formatCurrency(costs.shippingCost, quote.currency)}</dd>
                            </>
                          )}
                          {costs.otherCost > 0 && (
                            <>
                              <dt className="text-muted-foreground">Other</dt>
                              <dd className="text-right font-data">{formatCurrency(costs.otherCost, quote.currency)}</dd>
                            </>
                          )}
                          {costs.sharedCostShare > 0 &&
                            costs.packagingCost === 0 &&
                            costs.shippingCost === 0 &&
                            costs.otherCost === 0 && (
                            <>
                              <dt className="text-muted-foreground">Packaging / freight share</dt>
                              <dd className="text-right font-data">{formatCurrency(costs.sharedCostShare, quote.currency)}</dd>
                            </>
                          )}
                          <dt className="font-medium">Your total cost</dt>
                          <dd className="text-right font-data font-semibold">{formatCurrency(costs.totalCost, quote.currency)}</dd>
                        </dl>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Client price ({quote.currency})</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={itemPricing[i]?.clientPrice ?? ''}
                            onChange={(e) =>
                              setItemPricing({
                                ...itemPricing,
                                [i]: { clientPrice: e.target.value, advanceAmount: itemPricing[i]?.advanceAmount ?? '' },
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Advance (optional)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={itemPricing[i]?.advanceAmount ?? ''}
                            onChange={(e) =>
                              setItemPricing({
                                ...itemPricing,
                                [i]: { clientPrice: itemPricing[i]?.clientPrice ?? '', advanceAmount: e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>
                      {margin != null && clientPrice > 0 && (
                        <p className={`text-xs font-medium ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          Margin: {formatCurrency(margin, quote.currency)}
                        </p>
                      )}
                      {returnTo && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={saveProductPrice.isPending}
                          onClick={() => saveProductPrice.mutate(i)}
                        >
                          {saveProductPrice.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                          ) : (
                            'Save price & back to list'
                          )}
                        </Button>
                      )}
                    </div>
                  )
                })}
                {focusItemIndex == null && (
                  <div className="flex gap-2">
                    <Button onClick={() => approveQuote.mutate('approved')}>Approve & Buy</Button>
                    <Button variant="destructive" onClick={() => approveQuote.mutate('rejected')}>Reject</Button>
                  </div>
                )}
                {focusItemIndex != null && (
                  <p className="text-xs text-muted-foreground">
                    Price this product, save & return to list. Approve full request from pipeline when all products priced — or open request without product filter.
                  </p>
                )}
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
                    <div className="space-y-2">
                      <Label>Assign to client</Label>
                      <ClientPicker
                        value={selectedClientId || request.client_id || null}
                        onChange={(id) => setSelectedClientId(id ?? '')}
                        clients={clientsList ?? []}
                        allowNone={false}
                        noneLabel="Select a client"
                        noneDescription="Required to create a shipment"
                      />
                    </div>
                    {createError && <p className="text-sm text-red-500">{createError}</p>}
                    <Button
                      onClick={() => { setCreateError(null); createShipment.mutate() }}
                      disabled={createShipment.isPending || !(selectedClientId || request.client_id)}
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
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <PageHeader
        title="New Procurement Request"
        description="Describe products — hub quotes buy cost after you send. No pricing needed now."
        className="shrink-0"
      />

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[340px_1fr]">

        {/* ── Left: settings ── */}
        <Card className="flex flex-col overflow-hidden border-border/60 shadow-sm">
          <CardContent className="flex flex-col gap-6 overflow-y-auto p-5">

            <FormSection title="How to source">
              <OptionCardGroup
                name="request-mode"
                value={requestMode}
                onChange={setRequestMode}
                options={[
                  {
                    value: 'sourced',
                    label: REQUEST_MODE_LABELS.sourced,
                    description: REQUEST_MODE_HINTS.sourced,
                    icon: <Search className="h-5 w-5" />,
                  },
                  {
                    value: 'direct_buy',
                    label: REQUEST_MODE_LABELS.direct_buy,
                    description: REQUEST_MODE_HINTS.direct_buy,
                    icon: <Zap className="h-5 w-5" />,
                  },
                ]}
              />
            </FormSection>

            <FormSection title="Destination hub">
              <HubDestinationPicker
                value={targetHub}
                onChange={setTargetHub}
                hubs={ORIGIN_HUBS}
              />
            </FormSection>

            <FormSection title="Request details">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. March electronics order"
                    className="h-9"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions for the hub…"
                    className="resize-none text-sm"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Ownership">
              <OptionCardGroup
                name="shipment-type"
                value={shipmentType}
                onChange={setShipmentType}
                layout="grid"
                size="sm"
                options={[
                  {
                    value: 'client_owned',
                    label: 'Client-Owned',
                    description: 'Goods belong to client',
                    icon: <User className="h-4 w-4" />,
                  },
                  {
                    value: 'business_sourced',
                    label: 'Business',
                    description: 'Company inventory',
                    icon: <ShoppingBag className="h-4 w-4" />,
                  },
                ]}
              />
            </FormSection>

          </CardContent>
        </Card>

        {/* ── Right: client + products + footer ── */}
        <Card className="flex flex-col overflow-hidden border-border/60 shadow-sm">
          <div className="shrink-0 border-b bg-muted/10 px-5 py-4">
            <div className="mb-1 flex items-center gap-2">
              <User className="h-4 w-4 text-[var(--color-brand)]" />
              <h3 className="text-sm font-semibold">Client assignment</h3>
              <span className="text-[11px] text-muted-foreground">(optional)</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Link this request to one client, or leave unassigned for multi-client orders.
            </p>
            <ClientPicker
              value={clientId || null}
              onChange={(id) => setClientId(id ?? '')}
              clients={clientsList ?? []}
            />
          </div>

          <div className="flex shrink-0 items-center justify-between border-b bg-muted/20 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                <Package className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Products</h3>
                <p className="text-[11px] text-muted-foreground">{items.length} line{items.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setItems([...items, { name: '', quantity: 1, unit: 'pcs' }])
                setQtyStrings([...qtyStrings, '1'])
              }}
            >
              + Add product
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                    <span className="font-data text-xs font-semibold text-muted-foreground">
                      Product {i + 1}
                    </span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setItems(items.filter((_, idx) => idx !== i))
                          setQtyStrings(qtyStrings.filter((_, idx) => idx !== i))
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        placeholder="Product name"
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        className="h-9 flex-1"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          className="h-9 w-20"
                          value={qtyStrings[i] ?? String(item.quantity)}
                          onChange={(e) => setQty(i, e.target.value)}
                        />
                        <Input
                          placeholder="unit"
                          className="h-9 w-20"
                          value={item.unit ?? ''}
                          onChange={(e) => updateItem(i, { unit: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          Deadline <span className="font-normal">(optional)</span>
                        </Label>
                        <DateField
                          className="h-9"
                          value={item.deadline ?? ''}
                          onChange={(e) => updateItem(i, { deadline: e.target.value || null })}
                          onClear={() => updateItem(i, { deadline: null })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Source URL</Label>
                        <Input
                          type="url"
                          className="h-9"
                          placeholder="https://…"
                          value={item.sourceUrl ?? ''}
                          onChange={(e) => updateItem(i, { sourceUrl: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(item.images ?? []).map((url) => (
                        <div key={url} className="group relative h-14 w-14 overflow-hidden rounded-lg border">
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
                      <label className="flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-muted-foreground/40 text-muted-foreground transition-colors hover:border-[var(--color-brand)]/40 hover:bg-muted/50">
                        {uploadingIndex === i ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        <span className="text-[9px]">Photo</span>
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
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t bg-muted/10 px-5 py-4">
            {saveError && <p className="text-xs text-red-500">{saveError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => { setSaveError(null); saveRequest.mutate('draft') }}
                disabled={saveRequest.isPending}
              >
                Save draft
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => { setSaveError(null); saveRequest.mutate('sent') }}
                disabled={saveRequest.isPending}
              >
                {saveRequest.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  : 'Send to hub'}
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
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
