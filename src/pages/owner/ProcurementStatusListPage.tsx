import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Package, Search, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ProcurementProductSummaryDialog } from '@/components/ProcurementProductSummaryDialog'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import {
  OWNER_STATUS_SECTIONS,
  type ProcurementProductRow,
} from '@/components/ProcurementStatusBoard'
import { HUB_LABELS, SHIPMENT_TYPE_LABELS } from '@/lib/constants'
import type { ProcurementRequest, ProcurementStatus } from '@/types/database'

export function ProcurementStatusListPage() {
  const { status } = useParams<{ status: ProcurementStatus }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState<ProcurementProductRow | null>(null)

  const section = OWNER_STATUS_SECTIONS.find((s) => s.status === status)

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

  const productRows = useMemo(() => {
    if (!status) return []
    const q = search.trim().toLowerCase()
    return (requests ?? [])
      .filter((r) => r.status === status)
      .filter((r) => {
        if (!q) return true
        return (
          r.title.toLowerCase().includes(q) ||
          r.clients?.name?.toLowerCase().includes(q) ||
          r.items?.some((i) => i.name.toLowerCase().includes(q))
        )
      })
      .flatMap((request) =>
        (request.items ?? []).map((item, itemIndex) => ({ request, item, itemIndex }))
      ) as ProcurementProductRow[]
  }, [requests, search, status])

  if (!section) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Unknown status.</p>
        <Button variant="link" asChild className="px-0">
          <Link to="/owner/procurement">Back to pipeline</Link>
        </Button>
      </div>
    )
  }

  const returnPath = `/owner/procurement/status/${status}`
  const manageHref = (row: ProcurementProductRow) =>
    `/owner/procurement/${row.request.id}?item=${row.itemIndex}&return=${encodeURIComponent(returnPath)}`

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1" asChild>
            <Link to="/owner/procurement">
              <ArrowLeft className="h-4 w-4" /> Pipeline
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: section.accent }}
            />
            <div>
              <h2 className="text-xl font-bold">{section.label}</h2>
              <p className="text-xs text-muted-foreground">
                {productRows.length} product{productRows.length !== 1 ? 's' : ''} in this stage
              </p>
            </div>
          </div>
        </div>
        <div className="relative w-full min-w-[220px] sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search in this list…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : productRows.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed">
            <p className="text-sm text-muted-foreground">
              {search.trim() ? 'No matches in this stage.' : 'Nothing in this stage right now.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {productRows.map((row) => (
              <Card
                key={`${row.request.id}-${row.itemIndex}`}
                className="flex flex-col overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setSelectedRow(row)}
                  className="flex-1 p-4 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex gap-3">
                    {row.item.images?.[0] ? (
                      <img
                        src={row.item.images[0]}
                        alt={row.item.name}
                        className="h-14 w-14 shrink-0 rounded-lg border object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-semibold leading-snug">{row.item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.item.quantity} {row.item.unit ?? 'pcs'}
                      </p>
                      <div className="mt-2">
                        <ProcurementStatusBadge status={row.request.status} />
                      </div>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 border-t pt-3 text-xs">
                    {row.request.clients?.name && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="font-medium text-foreground">{row.request.clients.name}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                        {SHIPMENT_TYPE_LABELS[row.request.shipment_type]}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        {HUB_LABELS[row.request.target_hub]}
                      </span>
                    </div>
                    <p className="truncate text-muted-foreground">{row.request.title}</p>
                  </dl>
                </button>
                <div className="border-t bg-muted/10 p-3">
                  <Button
                    className="w-full gap-1"
                    size="sm"
                    onClick={() => navigate(manageHref(row))}
                  >
                    Manage product <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ProcurementProductSummaryDialog
        row={selectedRow}
        open={!!selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        manageHref={selectedRow ? manageHref(selectedRow) : '#'}
        showHub
        showQuickApprove
      />
    </div>
  )
}
