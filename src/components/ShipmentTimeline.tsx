import { Check } from 'lucide-react'
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_ORDER } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ShipmentStatus } from '@/types/database'

/**
 * Visual progress of a shipment through its lifecycle so users can see
 * exactly where it is and what the next step is.
 */
export function ShipmentTimeline({ status }: { status: ShipmentStatus }) {
  const currentIndex = SHIPMENT_STATUS_ORDER.indexOf(status)
  const nextStatus =
    currentIndex >= 0 && currentIndex < SHIPMENT_STATUS_ORDER.length - 1
      ? SHIPMENT_STATUS_ORDER[currentIndex + 1]
      : null

  return (
    <div className="space-y-3">
      <ol className="space-y-0">
        {SHIPMENT_STATUS_ORDER.map((s, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const isLast = i === SHIPMENT_STATUS_ORDER.length - 1
          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                    done && 'border-transparent text-white',
                    active && 'border-transparent text-white',
                    !done && !active && 'border-border bg-background text-muted-foreground'
                  )}
                  style={done || active ? { backgroundColor: 'var(--hub)' } : undefined}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {!isLast && (
                  <span
                    className={cn('my-0.5 w-px flex-1', done ? '' : 'bg-border')}
                    style={done ? { backgroundColor: 'var(--hub)' } : undefined}
                  />
                )}
              </div>
              <div className={cn('pb-4', isLast && 'pb-0')}>
                <p
                  className={cn(
                    'text-sm',
                    active ? 'font-semibold' : 'text-muted-foreground',
                    done && 'text-foreground'
                  )}
                >
                  {SHIPMENT_STATUS_LABELS[s]}
                </p>
                {active && <p className="text-xs text-muted-foreground">Current stage</p>}
              </div>
            </li>
          )
        })}
      </ol>
      {nextStatus && (
        <p className="rounded-md bg-[var(--hub-soft)] px-3 py-2 text-xs" style={{ color: 'var(--hub)' }}>
          Next step: {SHIPMENT_STATUS_LABELS[nextStatus]}
        </p>
      )}
    </div>
  )
}
