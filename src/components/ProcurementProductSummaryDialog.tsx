import { Link } from 'react-router-dom'
import { ArrowUpRight, Calendar, ExternalLink, Package, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import { ProcurementQuickApprovePanel } from '@/components/ProcurementQuickApprovePanel'
import { HUB_LABELS } from '@/lib/constants'
import { buildProductCostsFromQuote, type QuoteBreakdownLine } from '@/lib/quotePricing'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { ProcurementProductRow } from '@/components/ProcurementStatusBoard'
import type { ProcurementStatus } from '@/types/database'
import type { ReactNode } from 'react'

type ProcurementProductSummaryDialogProps = {
  row: ProcurementProductRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  manageHref: string
  showHub?: boolean
  canDelete?: boolean
  onDelete?: () => Promise<void> | void
  showQuickApprove?: boolean
  renderStatusBadge?: (status: ProcurementStatus) => ReactNode
}

function MetaItem({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

export function ProcurementProductSummaryDialog({
  row,
  open,
  onOpenChange,
  manageHref,
  showHub = true,
  canDelete = false,
  onDelete,
  showQuickApprove = false,
  renderStatusBadge,
}: ProcurementProductSummaryDialogProps) {
  if (!row) return null

  const { request, item, itemIndex } = row
  const quote = request.quotes?.[0]
  const productQuoteCosts =
    quote && request.items?.length
      ? buildProductCostsFromQuote(request.items, (quote.breakdown ?? []) as QuoteBreakdownLine[])[
          itemIndex
        ]
      : null
  const showApprove = showQuickApprove && request.status === 'quoted' && !!quote
  const StatusBadge = renderStatusBadge ?? ((status: ProcurementStatus) => (
    <ProcurementStatusBadge status={status} />
  ))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,820px)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="text-left text-base font-bold leading-tight">
              {item.name}
            </DialogTitle>
            <span className="text-sm text-muted-foreground">
              {item.quantity} {item.unit ?? 'pcs'}
            </span>
            {StatusBadge(request.status)}
          </div>
        </DialogHeader>

        {/* Body — two columns on md+ */}
        <div className="grid min-h-0 flex-1 md:grid-cols-[1.15fr_1fr]">
          {/* Left: product + context */}
          <div className="space-y-3 overflow-y-auto border-b p-4 md:border-b-0 md:border-r">
            <div className="flex gap-3">
              {item.images?.[0] ? (
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="h-16 w-16 shrink-0 rounded-lg border object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="h-6 w-6" />
                </span>
              )}
              {item.images && item.images.length > 1 && (
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                  {item.images.slice(1).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`${item.name} ${i + 2}`}
                      className="h-16 w-16 shrink-0 rounded-md border object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border bg-muted/20 p-3">
              {request.clients?.name && (
                <MetaItem label="Client">{request.clients.name}</MetaItem>
              )}
              <MetaItem label="Request">{request.title}</MetaItem>
              {showHub && (
                <MetaItem label="Hub">{HUB_LABELS[request.target_hub]}</MetaItem>
              )}
              <MetaItem label="Request ID">
                <span className="font-data text-xs">{request.id.slice(0, 8).toUpperCase()}</span>
              </MetaItem>
              {item.deadline && (
                <MetaItem label="Deadline">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {formatDate(item.deadline)}
                  </span>
                </MetaItem>
              )}
              {item.expectedSellingPrice != null && (
                <MetaItem label="Expected price">
                  {formatCurrency(item.expectedSellingPrice, 'USD')}
                </MetaItem>
              )}
              {item.sourceUrl && (
                <MetaItem label="Source" className="col-span-2">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                  >
                    <span className="truncate">Open link</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </MetaItem>
              )}
            </dl>

            {(item.notes || request.notes) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {item.notes && (
                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Product notes
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed">{item.notes}</p>
                  </div>
                )}
                {request.notes && (
                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Request notes
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed">{request.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: quote + quick approve */}
          <div className="flex min-h-0 flex-col overflow-y-auto p-4">
            {quote && productQuoteCosts ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Hub quote — this product
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {productQuoteCosts.productCost > 0 && (
                      <>
                        <span className="text-muted-foreground">Product buy</span>
                        <span className="text-right font-data">
                          {formatCurrency(productQuoteCosts.productCost, quote.currency)}
                        </span>
                      </>
                    )}
                    {productQuoteCosts.packagingCost > 0 && (
                      <>
                        <span className="text-muted-foreground">Packaging</span>
                        <span className="text-right font-data">
                          {formatCurrency(productQuoteCosts.packagingCost, quote.currency)}
                        </span>
                      </>
                    )}
                    {productQuoteCosts.shippingCost > 0 && (
                      <>
                        <span className="text-muted-foreground">Freight</span>
                        <span className="text-right font-data">
                          {formatCurrency(productQuoteCosts.shippingCost, quote.currency)}
                        </span>
                      </>
                    )}
                    {productQuoteCosts.otherCost > 0 && (
                      <>
                        <span className="text-muted-foreground">Other</span>
                        <span className="text-right font-data">
                          {formatCurrency(productQuoteCosts.otherCost, quote.currency)}
                        </span>
                      </>
                    )}
                    {productQuoteCosts.sharedCostShare > 0 &&
                      productQuoteCosts.packagingCost === 0 &&
                      productQuoteCosts.shippingCost === 0 &&
                      productQuoteCosts.otherCost === 0 && (
                      <>
                        <span className="text-muted-foreground">Packaging / freight</span>
                        <span className="text-right font-data">
                          {formatCurrency(productQuoteCosts.sharedCostShare, quote.currency)}
                        </span>
                      </>
                    )}
                    <span className="border-t pt-1.5 font-semibold">Line total</span>
                    <span className="border-t pt-1.5 text-right font-data font-semibold text-[var(--color-brand)]">
                      {formatCurrency(productQuoteCosts.totalCost, quote.currency)}
                    </span>
                  </div>
                </div>

                {showApprove && (
                  <ProcurementQuickApprovePanel
                    row={row}
                    layout="inline"
                    onDone={() => onOpenChange(false)}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">No hub quote for this product yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-muted/10 px-4 py-3">
          <Button asChild className="flex-1 sm:flex-none">
            <Link to={manageHref} onClick={() => onOpenChange(false)}>
              Manage product <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          {canDelete && onDelete && (
            <PasswordConfirmDialog
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              }
              title="Delete product"
              description={`Remove "${item.name}" from this procurement request? If it is the last product, the whole request will be deleted.`}
              actionLabel="Delete"
              destructive
              onConfirmed={async () => {
                await onDelete()
                onOpenChange(false)
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
