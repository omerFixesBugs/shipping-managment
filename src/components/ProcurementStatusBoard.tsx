import { ExternalLink, Package, ShoppingBag, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { HUB_LABELS, SHIPMENT_TYPE_LABELS } from '@/lib/constants'
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
  onSectionClick?: (section: ProcurementStatusSection) => void
  showHub?: boolean
  emptyMessage?: string
  hideEmptyColumns?: boolean
  /** Group multi-product requests together (hub new-request column). */
  groupByRequest?: boolean
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

export function groupRowsByRequest(rows: ProcurementProductRow[]) {
  const map = new Map<string, ProcurementProductRow[]>()
  for (const row of rows) {
    const list = map.get(row.request.id) ?? []
    list.push(row)
    map.set(row.request.id, list)
  }
  return Array.from(map.values())
}

export function ProcurementStatusBoard({
  sections,
  rows,
  isLoading,
  onProductClick,
  onSectionClick,
  showHub = true,
  emptyMessage = 'No products match your search.',
  hideEmptyColumns = false,
  groupByRequest = false,
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
          groupByRequest={groupByRequest && section.status === 'sent'}
          onSectionClick={onSectionClick}
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
  groupByRequest = false,
  onSectionClick,
}: {
  section: ProcurementStatusSection & { rows: ProcurementProductRow[] }
  rows: ProcurementProductRow[]
  onProductClick: (row: ProcurementProductRow) => void
  showHub: boolean
  groupByRequest?: boolean
  onSectionClick?: (section: ProcurementStatusSection) => void
}) {
  const requestGroups = groupByRequest ? groupRowsByRequest(rows) : null
  const productCount = rows.length
  const requestCount = requestGroups?.length ?? productCount

  return (
    <div className="flex w-[min(100%,300px)] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div
        className="shrink-0 border-b px-4 py-3"
        style={{ borderTopWidth: 3, borderTopColor: section.accent, borderTopStyle: 'solid' }}
      >
        {onSectionClick ? (
          <button
            type="button"
            onClick={() => onSectionClick(section)}
            className="flex w-full items-center justify-between gap-2 rounded-md text-left transition-colors hover:bg-muted/40 -mx-1 px-1 py-0.5"
          >
            <ColumnHeaderContent
              section={section}
              productCount={productCount}
              requestCount={requestCount}
              groupByRequest={groupByRequest}
            />
            <span
              className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: section.accent }}
            >
              {rows.length}
            </span>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <ColumnHeaderContent
              section={section}
              productCount={productCount}
              requestCount={requestCount}
              groupByRequest={groupByRequest}
            />
            <span
              className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: section.accent }}
            >
              {rows.length}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">Nothing here yet</p>
          </div>
        ) : groupByRequest && requestGroups ? (
          requestGroups.map((group) =>
            group.length > 1 ? (
              <RequestGroupCard
                key={group[0].request.id}
                rows={group}
                onProductClick={onProductClick}
                showHub={showHub}
              />
            ) : (
              <ProductCard
                key={`${group[0].request.id}-${group[0].itemIndex}`}
                row={group[0]}
                onClick={() => onProductClick(group[0])}
                showHub={showHub}
              />
            )
          )
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

function ColumnHeaderContent({
  section,
  productCount,
  requestCount,
  groupByRequest,
}: {
  section: ProcurementStatusSection
  productCount: number
  requestCount: number
  groupByRequest: boolean
}) {
  return (
    <div className="min-w-0">
      <h3 className="truncate text-sm font-semibold">{section.label}</h3>
      <p className="text-[11px] text-muted-foreground">
        {productCount === 0
          ? 'No products · open list'
          : groupByRequest && requestCount !== productCount
            ? `${requestCount} requests · ${productCount} products · open list`
            : `${productCount} products · open list`}
      </p>
    </div>
  )
}

function OwnershipBadge({ shipmentType }: { shipmentType: ProcurementRequest['shipment_type'] }) {
  const isClient = shipmentType === 'client_owned'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
        isClient
          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
          : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
      )}
    >
      {isClient ? <User className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
      {SHIPMENT_TYPE_LABELS[shipmentType]}
    </span>
  )
}

function RequestGroupCard({
  rows,
  onProductClick,
  showHub,
}: {
  rows: ProcurementProductRow[]
  onProductClick: (row: ProcurementProductRow) => void
  showHub: boolean
}) {
  const { request } = rows[0]
  return (
    <Card className="overflow-hidden border bg-background/80">
      <div className="border-b bg-muted/30 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {request.clients?.name && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold">
              <User className="h-3 w-3 text-muted-foreground" />
              {request.clients.name}
            </span>
          )}
          <OwnershipBadge shipmentType={request.shipment_type} />
          {showHub && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {HUB_LABELS[request.target_hub]}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-semibold">{request.title}</p>
        <p className="text-[10px] text-muted-foreground">{rows.length} products in this request</p>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <button
            key={`${row.request.id}-${row.itemIndex}`}
            type="button"
            onClick={() => onProductClick(row)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/40"
          >
            {row.item.images?.[0] ? (
              <img
                src={row.item.images[0]}
                alt={row.item.name}
                className="h-9 w-9 shrink-0 rounded border object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{row.item.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {row.item.quantity} {row.item.unit ?? 'pcs'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </Card>
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
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                  {item.name}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <p className="text-xs text-muted-foreground">
                  {item.quantity} {item.unit ?? 'pcs'}
                </p>
                <OwnershipBadge shipmentType={request.shipment_type} />
              </div>
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
