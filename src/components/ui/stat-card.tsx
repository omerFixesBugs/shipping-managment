import type { ComponentType, ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ComponentType<{ className?: string }>
  /** Small caption under the value, e.g. "On target" or "14 pending review". */
  hint?: ReactNode
  /** Trend pill, e.g. { value: '+12% vs last week', direction: 'up' }. */
  trend?: { value: string; direction: 'up' | 'down' | 'flat' }
  /** Pass true to render the value with the monospaced data font. */
  mono?: boolean
  /** Optional alert styling for warning metrics. */
  tone?: 'default' | 'warning'
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  mono,
  tone = 'default',
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-3 p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md',
        tone === 'warning' && 'border-amber-200 dark:border-amber-900/40',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md',
              tone === 'warning'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-[var(--color-brand-soft)] text-[var(--color-brand)] dark:bg-blue-950/40 dark:text-blue-300'
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className={cn('text-3xl font-bold leading-none', mono && 'font-data')}>{value}</div>
      <div className="flex items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              trend.direction === 'up' && 'text-emerald-600',
              trend.direction === 'down' && 'text-red-600',
              trend.direction === 'flat' && 'text-muted-foreground'
            )}
          >
            {trend.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  )
}
