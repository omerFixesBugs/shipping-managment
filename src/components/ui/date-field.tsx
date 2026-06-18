import * as React from 'react'
import { CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type DateFieldProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  onClear?: () => void
  showClear?: boolean
}

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  ({ className, value, onClear, showClear = true, ...props }, ref) => {
    const hasValue = Boolean(value)
    const canClear = showClear && hasValue && onClear

    return (
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={ref}
          type="date"
          value={value}
          className={cn(
            'date-field flex h-10 w-full rounded-md border border-input bg-background py-2 text-sm ring-offset-background',
            'pl-9',
            canClear ? 'pr-9' : 'pr-3',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        />
        {canClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            tabIndex={-1}
            aria-label="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
)
DateField.displayName = 'DateField'
