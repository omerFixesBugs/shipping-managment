import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS } from '@/lib/constants'

// Hub-side status labels — "sent" from admin = "new request" to hub
const HUB_STATUS_CONFIG: Record<string, { label: string; dot: string; className: string }> = {
  sent:          { label: 'New Request',       dot: '#3b82f6', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  quoted:        { label: 'Quote Submitted',   dot: '#a855f7', className: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  approved:      { label: 'Approved',          dot: '#22c55e', className: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  rejected:      { label: 'Rejected',          dot: '#ef4444', className: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  purchasing:    { label: 'Purchasing',        dot: '#f59e0b', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  ready_to_ship: { label: 'Ready to Ship',    dot: '#10b981', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  draft:         { label: 'Draft',             dot: '#94a3b8', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
}

function HubStatusBadge({ status }: { status: ProcurementStatus }) {
  const cfg = HUB_STATUS_CONFIG[status] ?? { label: status, dot: '#94a3b8', className: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  )
}
import { useExchangeRates, SUPPORTED_CURRENCIES, formatWithSymbol, convertAmount } from '@/hooks/useExchangeRates'
import { useState, useMemo, useEffect } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import type { ProcurementRequest, ProcurementStatus } from '@/types/database'

export function WarehouseProcurementListPage() {
  const { profile, user } = useAuth()
  const isBd = profile?.hub === 'bangladesh'

  // Hub managers (dubai/china) quote requests targeting their hub.
  // BD raises requests itself, so it sees the requests it created instead.
  const { data: requests } = useQuery({
    queryKey: isBd ? ['bd-procurement-requests', user?.id] : ['warehouse-procurement-list', profile?.hub],
    queryFn: async () => {
      const query = supabase
        .from('procurement_requests')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
      const { data, error } = isBd
        ? await query.eq('requested_by', user!.id)
        : await query.eq('target_hub', profile!.hub!)
      if (error) throw error
      return data as ProcurementRequest[]
    },
    enabled: isBd ? !!user?.id : !!profile?.hub,
  })

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-bold">{isBd ? 'My Procurement Requests' : 'Procurement Requests'}</h2>
        {isBd && (
          <Button asChild size="sm">
            <Link to="/warehouse/procurement/new">
              <Plus className="mr-1 h-4 w-4" /> New Request
            </Link>
          </Button>
        )}
      </div>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b px-4 py-3">
          <div className="grid grid-cols-[1fr_160px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Title</span>
            <span>Status</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!requests?.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {isBd ? 'No requests yet. Create one to source products from a hub.' : 'No procurement requests.'}
            </p>
          ) : (
            <ul className="divide-y">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/warehouse/procurement/${r.id}`}
                    className="grid grid-cols-[1fr_160px] items-center px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <span className="truncate text-sm font-medium" style={{ color: 'var(--hub)' }}>
                      {r.title}
                      {r.clients?.name ? <span className="ml-2 text-xs text-muted-foreground">· {r.clients.name}</span> : null}
                    </span>
                    <span><ProcurementStatusBadge status={r.status} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
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
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currency, setCurrency] = useState('USD')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])
  const [quoteInitialized, setQuoteInitialized] = useState(false)

  const { data: request, error: requestError } = useQuery<ProcurementRequest>({
    queryKey: ['procurement-request', id],
    queryFn: async () => {
      // Try with clients join first; fall back if client_id column not yet migrated
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*), clients(name)')
        .eq('id', id!)
        .single()
      if (!error) return data as ProcurementRequest
      // Retry without clients join
      const { data: data2, error: error2 } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*)')
        .eq('id', id!)
        .single()
      if (error2) throw error2
      return data2 as ProcurementRequest
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

      // Ready to ship = goods are physically in the hub. Land them in storage.
      if (status === 'ready_to_ship' && request) {
        const rows = (request.items ?? []).map((it) => ({
          hub: request.target_hub,
          client_id: request.client_id,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit ?? 'pcs',
          source_url: it.sourceUrl ?? null,
          images: it.images ?? [],
          weight_kg: null,
          volume_cbm: null,
          status: 'in_storage' as const,
          added_by: user!.id,
        }))
        if (rows.length) {
          const { error: invError } = await supabase.from('warehouse_inventory').insert(rows)
          if (invError) throw invError
        }
      }

      await supabase.functions.invoke('shipment-status', {
        body: { type: 'procurement_status', requestId: id, newStatus: status },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-request', id] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', profile?.hub] })
    },
  })

  if (requestError) return <p className="p-6 text-destructive">Failed to load request: {String(requestError)}</p>
  if (!request) return <p className="p-6 text-muted-foreground">Loading…</p>

  const quote = request.quotes?.[0]
  // Only the hub the request targets can quote / progress it. BD (the requester) is read-only here.
  const canManage = profile?.hub === request.target_hub
  const showQuoteForm = canManage && request.status === 'sent'

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">

      {/* ── Top info bar ── */}
      <div className="flex shrink-0 items-start justify-between rounded-lg border bg-card px-5 py-3">
        <div className="space-y-0.5">
          <p className="font-data text-[11px] uppercase tracking-widest text-muted-foreground">
            Incoming Request · {HUB_LABELS[request.target_hub]}
          </p>
          <h2 className="text-lg font-bold">{request.title}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {request.clients?.name && (
              <span>Client: <span className="font-medium text-foreground">{request.clients.name}</span></span>
            )}
            {request.notes && <span>{request.notes}</span>}
          </div>
        </div>
        {/* Hub-side status label — translates admin status into hub-meaningful language */}
        <HubStatusBadge status={request.status} />
      </div>

      {/* ── Main two-column area ── */}
      <div className="grid min-h-0 flex-1 grid-cols-[2fr_3fr] gap-4 overflow-hidden">

        {/* ── Left: requested items (rich cards) ── */}
        <Card className="flex flex-col overflow-hidden">
          <div className="shrink-0 border-b px-5 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                Requested Products
              </h3>
              <span className="text-xs text-muted-foreground">{request.items.length} item{request.items.length !== 1 ? 's' : ''}</span>
            </div>
            {request.clients?.name && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                For <span className="font-semibold text-foreground">{request.clients.name}</span>
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {request.items.map((item, i) => (
              <div key={i} className="rounded-lg border bg-background p-3 shadow-sm">
                {/* Images row */}
                {item.images && item.images.length > 0 && (
                  <div className="mb-2 flex gap-1.5">
                    {item.images.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={url} alt={item.name} className="h-16 w-16 rounded-md border object-cover hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
                {/* Name + source link */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{item.name}</p>
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {item.quantity} {item.unit ?? 'pcs'}
                  </span>
                </div>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-[11px] text-[var(--hub)] hover:underline break-all"
                  >
                    <span>↗</span>
                    <span className="truncate">{item.sourceUrl}</span>
                  </a>
                )}
                {/* Meta row */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {item.deadline && (
                    <span>Deadline: <span className="font-medium text-foreground">{item.deadline}</span></span>
                  )}
                  {item.expectedSellingPrice != null && (
                    <span>Exp. sell: <span className="font-medium text-foreground">${item.expectedSellingPrice.toFixed(2)}</span></span>
                  )}
                  {item.notes && <span className="w-full">{item.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Right: quote form / quote summary / actions ── */}
        <Card className="flex flex-col overflow-hidden">

          {/* Quote form — status: sent (only the quoting hub) */}
          {showQuoteForm && (
            <>
              <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">Submit Quote</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Currency</span>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-7 w-52 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.code} — {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Line items table */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium w-5"></th>
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium w-24 text-right">Qty</th>
                      <th className="pb-2 font-medium w-44 text-right">Unit Price ({currency})</th>
                      <th className="pb-2 font-medium w-28 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.map((li, i) => {
                      const subtotal = (parseFloat(li.unitPrice) || 0) * li.quantity
                      const dotColor = li.type === 'item' ? 'var(--hub)' : li.type === 'packaging' ? '#8b5cf6' : '#f59e0b'
                      return (
                        <tr key={i}>
                          <td className="py-2 pr-1">
                            <span className="mt-2 block h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              value={li.label}
                              onChange={(e) => updateLine(i, { label: e.target.value })}
                              className="h-8"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number" min={1}
                              value={li.quantity}
                              onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                              className="text-right"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number" min={0} step="0.01" placeholder="0.00"
                              value={li.unitPrice}
                              onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                              className="text-right"
                            />
                          </td>
                          <td className="py-2 text-right font-semibold">
                            {formatWithSymbol(subtotal, currency)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={4} className="pt-3 font-semibold text-right pr-3">Total ({currency})</td>
                      <td className="pt-3 text-right text-lg font-bold" style={{ color: 'var(--hub)' }}>
                        {formatWithSymbol(totalInCurrency, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setLineItems([...lineItems, { label: 'Additional cost', quantity: 1, unitPrice: '', type: 'other' }])}
                >
                  + Add line
                </Button>

                {/* Live conversion */}
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Live equivalents</span>
                    <button
                      type="button"
                      onClick={() => refetchRates()}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={`h-3 w-3 ${ratesLoading ? 'animate-spin' : ''}`} />
                      Refresh rates
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                    {SUPPORTED_CURRENCIES.filter(c => c.code !== currency).map((c) => (
                      <div key={c.code} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{c.code}</span>
                        <span className="font-medium tabular-nums">
                          {rates ? formatWithSymbol(convertAmount(totalInCurrency, rates, c.code), c.code) : '…'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes for owner</Label>
                  <Textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} rows={3} placeholder="Explain pricing, availability, or substitutions…" />
                </div>
              </div>

              {/* Pinned footer */}
              <div className="shrink-0 border-t px-5 py-3 flex items-center gap-3">
                <Button
                  onClick={() => submitQuote.mutate()}
                  disabled={submitQuote.isPending || totalInCurrency === 0}
                >
                  {submitQuote.isPending ? 'Submitting…' : 'Submit Quote'}
                </Button>
                {totalInCurrency > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Total: <strong>{formatWithSymbol(totalInCurrency, currency)}</strong>
                  </span>
                )}
                {submitQuote.isError && (
                  <p className="text-sm text-red-500">{(submitQuote.error as Error).message}</p>
                )}
              </div>
            </>
          )}

          {/* Quote summary / status (also the read-only view for the requester) */}
          {!showQuoteForm && (
            <>
              <div className="shrink-0 border-b px-5 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">Quote & Status</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {quote && (
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Quote Total</span>
                      <span className="text-2xl font-bold">{formatWithSymbol(quote.total_cost, quote.currency)}</span>
                    </div>
                    {(quote.breakdown as {type: string; item: string; quantity: number; unitPrice: number; cost: number}[])?.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 font-medium">Item</th>
                            <th className="pb-2 font-medium text-right">Qty</th>
                            <th className="pb-2 font-medium text-right">Unit</th>
                            <th className="pb-2 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(quote.breakdown as {item: string; quantity: number; unitPrice: number; cost: number}[]).map((b, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2">{b.item}</td>
                              <td className="py-2 text-right text-muted-foreground">{b.quantity}</td>
                              <td className="py-2 text-right text-muted-foreground">{formatWithSymbol(b.unitPrice, quote.currency)}</td>
                              <td className="py-2 text-right font-semibold">{formatWithSymbol(b.cost, quote.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {quote.notes && (
                      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{quote.notes}</p>
                    )}
                  </div>
                )}

                {/* Action buttons — only the quoting hub can progress the request */}
                {canManage && request.status === 'approved' && (
                  <div className="rounded-lg border border-dashed p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Quote approved. Begin sourcing the products.</p>
                    <Button onClick={() => updateStatus.mutate('purchasing')}>Start Purchasing</Button>
                  </div>
                )}
                {canManage && request.status === 'purchasing' && (
                  <div className="rounded-lg border border-dashed p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Products are being sourced. Mark ready once goods are in hand.</p>
                    <Button onClick={() => updateStatus.mutate('ready_to_ship')}>Mark Ready to Ship</Button>
                  </div>
                )}
                {!canManage && request.status === 'sent' && (
                  <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Sent to {HUB_LABELS[request.target_hub]} hub — awaiting their quote.
                  </p>
                )}
                {request.status === 'ready_to_ship' && (
                  <div className="rounded-lg border border-dashed p-4 space-y-2">
                    {linkedShipment ? (
                      <>
                        <p className="text-sm text-muted-foreground">Goods ready — shipment created. Track from shipments page.</p>
                        <Button variant="outline" onClick={() => navigate(`/warehouse/shipments/${linkedShipment.id}`)}>
                          Open shipment {linkedShipment.reference_code}
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Marked ready to ship. Products are now in <strong>Storage</strong> — ship them from there, or head office can create the shipment.
                      </p>
                    )}
                  </div>
                )}

              </div>
            </>
          )}

        </Card>

      </div>
    </div>
  )
}
