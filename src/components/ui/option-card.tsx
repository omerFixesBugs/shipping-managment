import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type OptionCardItem<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: ReactNode
}

type OptionCardGroupProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: OptionCardItem<T>[]
  layout?: 'stack' | 'grid'
  size?: 'sm' | 'md'
  name?: string
}

export function OptionCardGroup<T extends string>({
  value,
  onChange,
  options,
  layout = 'stack',
  size = 'md',
  name,
}: OptionCardGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'group relative flex w-full text-left transition-all duration-200',
              layout === 'grid' ? 'flex-col items-center text-center' : 'items-start gap-3',
              size === 'sm' ? 'rounded-lg p-2.5' : 'rounded-xl p-3.5',
              selected
                ? 'border-2 border-[var(--color-brand)] bg-[var(--color-brand)]/5 shadow-sm ring-1 ring-[var(--color-brand)]/20'
                : 'border border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
            )}
          >
            <span
              className={cn(
                'absolute flex items-center justify-center rounded-full transition-all',
                layout === 'grid' ? 'right-2 top-2' : 'right-3 top-3',
                size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
                selected
                  ? 'bg-[var(--color-brand)] text-white scale-100 opacity-100'
                  : 'scale-75 border border-muted-foreground/30 bg-background opacity-0 group-hover:opacity-40'
              )}
            >
              {selected && <Check className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={3} />}
            </span>

            {opt.icon && (
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-lg transition-colors',
                  size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
                  selected
                    ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]'
                    : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                )}
              >
                {opt.icon}
              </span>
            )}

            <div className={cn('min-w-0 flex-1', layout === 'grid' && 'pt-1')}>
              <p className={cn('font-semibold leading-tight', size === 'sm' ? 'text-xs' : 'text-sm')}>
                {opt.label}
              </p>
              {opt.description && (
                <p className={cn('mt-0.5 text-muted-foreground', size === 'sm' ? 'text-[10px] leading-snug' : 'text-xs leading-relaxed')}>
                  {opt.description}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

type SegmentedControlProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex w-full rounded-lg bg-muted/60 p-1',
        className
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200',
              selected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
