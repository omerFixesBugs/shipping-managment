import { ExternalLink, Package, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { HUB_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ProcurementItem, ProcurementRequest, ProcurementStatus } from '@/types/database'

export type ProcurementProductRow = {
  request: ProcurementRequest
  item: ProcurementItem
  itemIndex: number
}

export type ProcurementStatusSection = {
  status: ProcurementStatus
  label: string
  accent: string
}

export const OWNER_STATUS_SECTIONS: ProcurementStatusSection[] = [
  { status: 'draft', label: 'Draft', accent: '#94a3b8' },
  { status: 'sent', label: 'Awaiting Quote', accent: '#3b82f6' },
  { status: 'quoted', label: 'Pending Approval', accent: '#f59e0b' },
  { status: 'approved', label: 'Approved', accent: '#10b981' },
  { status: 'purchasing', label: 'Purchasing', accent: '#8b5cf6' },
  { status: 'ready_to_ship', label: 'Ready to Ship', accent: '#059669' },
  { status: 'rejected', label: 'Rejected', accent: '#ef4444' },
]

export const HUB_STATUS_SECTIONS: ProcurementStatusSection[] = [
  { status: 'sent', label: 'New Requests', accent: '#3b82f6' },
  { status: 'quoted', label: 'Quote Submitted', accent: '#a855f7' },
  { status: 'approved', label: 'Approved', accent: '#22c55e' },
  { status: 'purchasing', label: 'Purchasing', accent: '#f59e0b' },
  { status: 'ready_to_ship', label: 'Ready to Ship', accent: '#10b981' },
  { status: 'rejected', label: 'Rejected', accent: '#ef4444' },
  { status: 'draft', label: 'Draft', accent: '#94a3b8' },
]

type ProcurementStatusBoardProps = {
  sections: ProcurementStatusSection[]
  rows: ProcurementProductRow[]
  isLoading?: boolean
  onProductClick: (row: ProcurementProductRow) => void
  showHub?: boolean
  emptyMessage?: string
  hideEmptyColumns?: boolean
}

export function groupProductsByStatus(
  rows: ProcurementProductRow[],
  sections: ProcurementStatusSection[],
  hideEmptyColumns = false
) {
  const byStatus = new Map<ProcurementStatus, ProcurementProductRow[]>()
  for (const row of rows) {
    const list = byStatus.get(row.request.status) ?? []
    list.push(row)
    byStatus.set(row.request.status, list)
  }
  const grouped = sections.map((section) => ({
    ...section,
    rows: byStatus.get(section.status) ?? [],
  }))
  return hideEmptyColumns ? grouped.filter((s) => s.rows.length > 0) : grouped
}

export function ProcurementStatusBoard({
  sections,
  rows,
  isLoading,
  onProductClick,
  showHub = true,
  emptyMessage = 'No products match your search.',
  hideEmptyColumns = false,
}: ProcurementStatusBoardProps) {
  const grouped = groupProductsByStatus(rows, sections, hideEmptyColumns)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading procurement board…</p>
      </div>
    )
  }

  if (grouped.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-muted/20">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-1">
      {grouped.map((section) => (
        <StatusColumn
          key={section.status}
          section={section}
          rows={section.rows}
          onProductClick={onProductClick}
          showHub={showHub}
        />
      ))}
    </div>
  )
}

function StatusColumn({
  section,
  rows,
  onProductClick,
  showHub,
}: {
  section: ProcurementStatusSection & { rows: ProcurementProductRow[] }
  rows: ProcurementProductRow[]
  onProductClick: (row: ProcurementProductRow) => void
  showHub: boolean
}) {
  return (
    <div className="flex w-[min(100%,300px)] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div
        className="shrink-0 border-b px-4 py-3"
        style={{ borderTopWidth: 3, borderTopColor: section.accent, borderTopStyle: 'solid' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{section.label}</h3>
            <p className="text-[11px] text-muted-foreground">
              {rows.length === 0 ? 'No products' : `${rows.length} product${rows.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <span
            className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: section.accent }}
          >
            {rows.length}
          </span>
        </div>
      </div>

      <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">Nothing here yet</p>
          </div>
        ) : (
          rows.map((row) => (
            <ProductCard
              key={`${row.request.id}-${row.itemIndex}`}
              row={row}
              onClick={() => onProductClick(row)}
              showHub={showHub}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ProductCard({
  row,
  onClick,
  showHub,
}: {
  row: ProcurementProductRow
  onClick: () => void
  showHub: boolean
}) {
  const { request, item } = row
  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <Card className="overflow-hidden border bg-background/80 transition-all hover:border-primary/30 hover:shadow-md">
        <div className="p-3">
          <div className="flex gap-3">
            {item.images?.[0] ? (
              <img
                src={item.images[0]}
                alt={item.name}
                className="h-14 w-14 shrink-0 rounded-lg border object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Package className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                {item.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.quantity} {item.unit ?? 'pcs'}
              </p>
            </div>
          </div>

          <dl className="mt-3 space-y-1.5 border-t pt-2.5 text-xs">
            {request.clients?.name && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                <dt className="sr-only">Client</dt>
                <dd className="truncate font-medium text-foreground">{request.clients.name}</dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Request
                </dt>
                <dd className="truncate font-medium">{request.title}</dd>
              </div>
              {showHub && (
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {HUB_LABELS[request.target_hub]}
                </span>
              )}
            </div>
            {item.sourceUrl && (
              <div className="flex items-center gap-1 text-primary">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">Product link</span>
              </div>
            )}
            {item.notes && (
              <p className={cn('line-clamp-2 text-muted-foreground')}>{item.notes}</p>
            )}
          </dl>
        </div>
      </Card>
    </button>
  )
}
