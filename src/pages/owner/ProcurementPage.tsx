import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, Package, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ProcurementRequest, ProcurementStatus } from '@/types/database'

type Tab = 'all' | 'awaiting_quote' | 'pending_approval' | 'purchased'

const TABS: { id: Tab; label: string; match: (s: ProcurementStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'awaiting_quote', label: 'Awaiting Quote', match: (s) => s === 'draft' || s === 'sent' },
  { id: 'pending_approval', label: 'Pending Approval', match: (s) => s === 'quoted' },
  {
    id: 'purchased',
    label: 'Purchased',
    match: (s) => s === 'approved' || s === 'purchasing' || s === 'ready_to_ship',
  },
]

// Ordered lifecycle used to render the workflow progress stepper.
const WORKFLOW: { status: ProcurementStatus; label: string }[] = [
  { status: 'sent', label: 'Request Sent' },
  { status: 'quoted', label: 'Quote Received' },
  { status: 'approved', label: 'Approved' },
  { status: 'purchasing', label: 'Purchasing' },
  { status: 'ready_to_ship', label: 'Ready for Cargo' },
]

export function ProcurementPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: requests, isLoading } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*), clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ProcurementRequest[]
    },
  })

  const activeTab = TABS.find((t) => t.id === tab)!
  const filtered = useMemo(() => {
    return (requests ?? []).filter(
      (r) =>
        activeTab.match(r.status) &&
        (!search || r.title.toLowerCase().includes(search.toLowerCase()))
    )
  }, [requests, activeTab, search])

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      {/* Header row */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sourcing Requests</h2>
          <p className="text-xs text-muted-foreground">Manage active procurement items and supplier quotes.</p>
        </div>
        <Button asChild>
          <Link to="/owner/procurement/new">
            <ShoppingCart className="h-4 w-4" /> New Request
          </Link>
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-4 overflow-hidden">

        {/* ── Master list ── */}
        <Card className="flex flex-col overflow-hidden shadow-[var(--shadow-card)]">
          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    tab === t.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative ml-auto min-w-[160px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">No requests in this view.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((r) => {
                  const isActive = selected?.id === r.id
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40',
                          isActive && 'bg-accent/50'
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.clients?.name ? `${r.clients.name} · ` : ''}
                            {HUB_LABELS[r.target_hub]} · {r.items?.length ?? 0} items ·{' '}
                            {formatDate(r.created_at)}
                          </p>
                        </div>
                        <ProcurementStatusBadge status={r.status} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t px-4 py-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {requests?.length ?? 0} requests
            </p>
          </div>
        </Card>

        {/* ── Detail panel ── */}
        <div className="overflow-y-auto">
          {selected ? (
            <ProcurementDetailPanel request={selected} />
          ) : (
            <Card className="shadow-[var(--shadow-card)]">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Select a request to view its workflow.
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  )
}

function ProcurementDetailPanel({ request }: { request: ProcurementRequest }) {
  const queryClient = useQueryClient()
  const quote = request.quotes?.[0]
  const currentIdx = WORKFLOW.findIndex((w) => w.status === request.status)
  const isRejected = request.status === 'rejected'

  const deleteRequest = async () => {
    const { error } = await supabase.from('procurement_requests').delete().eq('id', request.id)
    if (error) throw error
    queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
  }

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-data text-xs text-muted-foreground">
              REQ · {request.id.slice(0, 8).toUpperCase()}
            </p>
            <h3 className="mt-0.5 text-lg font-bold">{request.title}</h3>
            <p className="text-xs text-muted-foreground">
              {request.clients?.name ? `${request.clients.name} · ` : ''}
              {HUB_LABELS[request.target_hub]}
            </p>
          </div>
          <ProcurementStatusBadge status={request.status} />
        </div>

        {/* Workflow progress */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workflow Progress
          </p>
          {isRejected ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              This request was rejected.
            </p>
          ) : (
            <ol className="space-y-3">
              {WORKFLOW.map((step, idx) => {
                const done = idx < currentIdx
                const current = idx === currentIdx
                return (
                  <li key={step.status} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                        done && 'bg-emerald-500 text-white',
                        current && 'bg-[var(--color-brand)] text-white',
                        !done && !current && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span
                      className={cn(
                        'text-sm',
                        current ? 'font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Quote details */}
        {quote ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quote Details
            </p>
            <dl className="space-y-1.5 text-sm">
              {quote.breakdown?.slice(0, 4).map((b, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-muted-foreground">{b.item}</dt>
                  <dd className="font-data">{formatCurrency(Number(b.cost), quote.currency)}</dd>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                <dt>Total Quote</dt>
                <dd className="font-data">
                  {formatCurrency(Number(quote.total_cost), quote.currency)}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            No quote received yet.
          </p>
        )}

        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link to={`/owner/procurement/${request.id}`}>
              Open &amp; Manage <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <PasswordConfirmDialog
            trigger={
              <Button variant="outline" size="icon" title="Delete request">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            }
            title="Delete procurement request"
            description={`Permanently delete "${request.title}" and its products? This cannot be undone.`}
            actionLabel="Delete"
            destructive
            onConfirmed={deleteRequest}
          />
        </div>
      </CardContent>
    </Card>
  )
}
