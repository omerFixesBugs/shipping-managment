import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Check, Package, Search, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
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
        .select('*, quotes(*)')
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
    <div className="space-y-6">
      <PageHeader
        title="Sourcing Requests"
        description="Manage active procurement items and supplier quotes."
        actions={
          <Button asChild>
            <Link to="/owner/procurement/new">
              <ShoppingCart className="h-4 w-4" /> New Request
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Master list */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="relative ml-auto min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  No requests in this view.
                </p>
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
                            <p className="text-xs text-muted-foreground">
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
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {requests?.length ?? 0} requests
          </p>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
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
  const quote = request.quotes?.[0]
  const currentIdx = WORKFLOW.findIndex((w) => w.status === request.status)
  const isRejected = request.status === 'rejected'

  return (
    <Card className="sticky top-6 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-data text-xs text-muted-foreground">
              REQ · {request.id.slice(0, 8).toUpperCase()}
            </p>
            <h3 className="mt-0.5 text-lg font-bold">{request.title}</h3>
            <p className="text-xs text-muted-foreground">{HUB_LABELS[request.target_hub]}</p>
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

        <Button asChild className="w-full">
          <Link to={`/owner/procurement/${request.id}`}>
            Open &amp; Manage <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
