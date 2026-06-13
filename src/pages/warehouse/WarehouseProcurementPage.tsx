import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import { ItemSummary } from '@/pages/owner/ProcurementFormPage'
import { HUB_LABELS } from '@/lib/constants'
import { useExchangeRates, SUPPORTED_CURRENCIES, formatWithSymbol, convertAmount } from '@/hooks/useExchangeRates'
import { useState, useMemo, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import type { ProcurementRequest } from '@/types/database'

export function WarehouseProcurementListPage() {
  const { profile } = useAuth()

  const { data: requests } = useQuery({
    queryKey: ['warehouse-procurement-list', profile?.hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*')
        .eq('target_hub', profile!.hub!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ProcurementRequest[]
    },
    enabled: !!profile?.hub,
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Procurement Requests</h2>
      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests?.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-3">
                    <Link to={`/warehouse/procurement/${r.id}`} className="font-medium hover:underline" style={{ color: 'var(--hub)' }}>
                      {r.title}
                    </Link>
                  </td>
                  <td className="py-3">
                    <ProcurementStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {!requests?.length && (
                <tr><td colSpan={2} className="py-8 text-center text-muted-foreground">No procurement requests.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

interface QuoteLineItem {
  label: string
  quantity: number
  unitPrice: string
  type: 'item' | 'packaging' | 'shipping' | 'other'
}

export function WarehouseProcurementDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currency, setCurrency] = useState('USD')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])
  const [quoteInitialized, setQuoteInitialized] = useState(false)

  const { data: request } = useQuery<ProcurementRequest>({
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
  })

  useEffect(() => {
    if (!quoteInitialized && request?.status === 'sent') {
      setLineItems([
        ...request.items.map((item) => ({
          label: item.name,
          quantity: item.quantity,
          unitPrice: '',
          type: 'item' as const,
        })),
        { label: 'Packaging', quantity: 1, unitPrice: '', type: 'packaging' },
        { label: 'Shipping / Freight', quantity: 1, unitPrice: '', type: 'shipping' },
      ])
      setQuoteInitialized(true)
    }
  }, [request, quoteInitialized])

  const { data: rates, isLoading: ratesLoading, refetch: refetchRates } = useExchangeRates(currency)

  const totalInCurrency = useMemo(() => {
    return lineItems.reduce((sum, li) => {
      const price = parseFloat(li.unitPrice) || 0
      return sum + price * li.quantity
    }, 0)
  }, [lineItems])

  const updateLine = (index: number, patch: Partial<QuoteLineItem>) => {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)))
  }

  const { data: linkedShipment } = useQuery({
    queryKey: ['procurement-shipment', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('shipments').select('id, reference_code')
        .eq('procurement_request_id', id!).maybeSingle()
      return data as { id: string; reference_code: string } | null
    },
    enabled: !!request,
  })

  const submitQuote = useMutation({
    mutationFn: async () => {
      const breakdown = lineItems.map((li) => ({
        type: li.type,
        item: li.label,
        quantity: li.quantity,
        unitPrice: parseFloat(li.unitPrice) || 0,
        cost: (parseFloat(li.unitPrice) || 0) * li.quantity,
      }))

      const { error: quoteError } = await supabase.from('quotes').insert({
        request_id: id!,
        manager_id: user!.id,
        total_cost: totalInCurrency,
        currency,
        breakdown,
        notes: quoteNotes || null,
      })
      if (quoteError) throw quoteError

      const { error: reqError } = await supabase
        .from('procurement_requests').update({ status: 'quoted' }).eq('id', id!)
      if (reqError) throw reqError

      await supabase.functions.invoke('shipment-status', {
        body: { type: 'procurement_status', requestId: id, newStatus: 'quoted' },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-request', id] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: async (status: 'purchasing' | 'ready_to_ship') => {
      const { error } = await supabase
        .from('procurement_requests').update({ status }).eq('id', id!)
      if (error) throw error
      await supabase.functions.invoke('shipment-status', {
        body: { type: 'procurement_status', requestId: id, newStatus: status },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-request', id] })
    },
  })

  if (!request) return <p className="text-muted-foreground">Loading...</p>

  const quote = request.quotes?.[0]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{request.title}</h2>
        <ProcurementStatusBadge status={request.status} />
      </div>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Requested Products</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground"><strong>Hub:</strong> {HUB_LABELS[request.target_hub]}</p>
          {request.notes && <p className="text-sm text-muted-foreground"><strong>Notes:</strong> {request.notes}</p>}
          <div className="space-y-3">
            {request.items.map((item, i) => <ItemSummary key={i} item={item} />)}
          </div>
        </CardContent>
      </Card>

      {/* Quote form */}
      {request.status === 'sent' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Submit Quote</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Quote currency:</span>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Line items */}
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_80px_120px_100px] gap-2 text-xs font-medium text-muted-foreground pb-1">
                <span>Description</span><span>Qty</span><span>Unit Price ({currency})</span><span>Subtotal</span>
              </div>
              {lineItems.map((li, i) => {
                const subtotal = (parseFloat(li.unitPrice) || 0) * li.quantity
                return (
                  <div key={i} className="grid grid-cols-[1fr_80px_120px_100px] items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: li.type === 'item' ? 'var(--hub)' : li.type === 'packaging' ? '#8b5cf6' : '#f59e0b' }}
                      />
                      <Input
                        value={li.label}
                        onChange={(e) => updateLine(i, { label: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Input
                      type="number" min={1} value={li.quantity}
                      onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number" min={0} step="0.01" placeholder="0.00"
                      value={li.unitPrice}
                      onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <span className="text-sm font-medium">{formatWithSymbol(subtotal, currency)}</span>
                  </div>
                )
              })}
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setLineItems([...lineItems, { label: 'Additional cost', quantity: 1, unitPrice: '', type: 'other' }])}
              >
                + Add line
              </Button>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="font-semibold">Total ({currency})</span>
              <span className="text-xl font-bold">{formatWithSymbol(totalInCurrency, currency)}</span>
            </div>

            {/* Live conversion table */}
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Live equivalent amounts</span>
                <button
                  type="button"
                  onClick={() => refetchRates()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`h-3 w-3 ${ratesLoading ? 'animate-spin' : ''}`} />
                  Refresh rates
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                {SUPPORTED_CURRENCIES.filter(c => c.code !== currency).map((c) => (
                  <div key={c.code} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{c.code}</span>
                    <span className="font-medium">
                      {rates ? formatWithSymbol(convertAmount(totalInCurrency, rates, c.code), c.code) : '…'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} rows={2} />
            </div>
            <Button
              onClick={() => submitQuote.mutate()}
              disabled={submitQuote.isPending || totalInCurrency === 0}
            >
              {submitQuote.isPending ? 'Submitting…' : 'Submit Quote'}
            </Button>
            {submitQuote.isError && (
              <p className="text-sm text-red-500">{(submitQuote.error as Error).message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing quote display */}
      {quote && request.status !== 'sent' && (
        <Card>
          <CardHeader><CardTitle>Quote Submitted</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatWithSymbol(quote.total_cost, quote.currency)}</span>
            </div>
            {(quote.breakdown as {type: string; item: string; quantity: number; unitPrice: number; cost: number}[])?.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">Item</th><th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit</th><th className="pb-2 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {(quote.breakdown as {item: string; quantity: number; unitPrice: number; cost: number}[]).map((b, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5">{b.item}</td>
                      <td className="py-1.5 text-right">{b.quantity}</td>
                      <td className="py-1.5 text-right">{formatWithSymbol(b.unitPrice, quote.currency)}</td>
                      <td className="py-1.5 text-right font-medium">{formatWithSymbol(b.cost, quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {quote.notes && <p className="text-sm text-muted-foreground">{quote.notes}</p>}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {request.status === 'approved' && (
        <Card>
          <CardContent className="pt-6">
            <Button onClick={() => updateStatus.mutate('purchasing')}>Start Purchasing</Button>
          </CardContent>
        </Card>
      )}
      {request.status === 'purchasing' && (
        <Card>
          <CardContent className="pt-6">
            <Button onClick={() => updateStatus.mutate('ready_to_ship')}>Mark Ready to Ship</Button>
          </CardContent>
        </Card>
      )}

      {request.status === 'ready_to_ship' && (
        <Card>
          <CardContent className="pt-6">
            {linkedShipment ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  These goods are ready and have been turned into a shipment.
                  Move it through dispatch stages from the shipment page.
                </p>
                <Button variant="outline" onClick={() => navigate(`/warehouse/shipments/${linkedShipment.id}`)}>
                  Open shipment {linkedShipment.reference_code}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Marked ready to ship. The head office will create a shipment — it will appear under <strong>Shipments</strong>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
