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
import { HUB_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
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
  renderStatusBadge?: (status: ProcurementStatus) => ReactNode
}

export function ProcurementProductSummaryDialog({
  row,
  open,
  onOpenChange,
  manageHref,
  showHub = true,
  canDelete = false,
  onDelete,
  renderStatusBadge,
}: ProcurementProductSummaryDialogProps) {
  if (!row) return null

  const { request, item } = row
  const quote = request.quotes?.[0]
  const StatusBadge = renderStatusBadge ?? ((status: ProcurementStatus) => (
    <ProcurementStatusBadge status={status} />
  ))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 text-left">Product Summary</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex gap-4">
            {item.images?.[0] ? (
              <img
                src={item.images[0]}
                alt={item.name}
                className="h-20 w-20 shrink-0 rounded-lg border object-cover"
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Package className="h-8 w-8" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold leading-tight">{item.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.quantity} {item.unit ?? 'pcs'}
              </p>
              <div className="mt-2">{StatusBadge(request.status)}</div>
            </div>
          </div>

          {item.images && item.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {item.images.slice(1).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${item.name} ${i + 2}`}
                  className="h-14 w-14 shrink-0 rounded-md border object-cover"
                />
              ))}
            </div>
          )}

          <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            {request.clients?.name && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Client</dt>
                <dd className="text-right font-medium">{request.clients.name}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Request</dt>
              <dd className="text-right font-medium">{request.title}</dd>
            </div>
            {showHub && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Target Hub</dt>
                <dd className="text-right font-medium">{HUB_LABELS[request.target_hub]}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Request ID</dt>
              <dd className="font-data text-right text-xs">{request.id.slice(0, 8).toUpperCase()}</dd>
            </div>
            {item.deadline && (
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Deadline
                </dt>
                <dd className="font-medium">{formatDate(item.deadline)}</dd>
              </div>
            )}
            {item.expectedSellingPrice != null && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Expected Price</dt>
                <dd className="font-data font-medium">
                  {formatCurrency(item.expectedSellingPrice, 'USD')}
                </dd>
              </div>
            )}
            {item.sourceUrl && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Source</dt>
                <dd>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open link <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {item.notes && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Product Notes
              </p>
              <p className="rounded-md border bg-background px-3 py-2 text-sm">{item.notes}</p>
            </div>
          )}

          {request.notes && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Request Notes
              </p>
              <p className="rounded-md border bg-background px-3 py-2 text-sm">{request.notes}</p>
            </div>
          )}

          {quote && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quote Summary
              </p>
              <dl className="space-y-1.5 text-sm">
                {quote.breakdown?.slice(0, 4).map((b, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{b.item}</dt>
                    <dd className="font-data">{formatCurrency(Number(b.cost), quote.currency)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="font-data">
                    {formatCurrency(Number(quote.total_cost), quote.currency)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Button asChild className="flex-1">
              <Link to={manageHref} onClick={() => onOpenChange(false)}>
                Manage Product <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            {canDelete && onDelete && (
              <PasswordConfirmDialog
                trigger={
                  <Button variant="destructive" className="sm:shrink-0">
                    <Trash2 className="h-4 w-4" /> Delete Product
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
