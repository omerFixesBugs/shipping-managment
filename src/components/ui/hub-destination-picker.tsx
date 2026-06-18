import { Check, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HUB_LABELS, HUB_THEMES } from '@/lib/constants'
import type { HubType } from '@/types/database'

const HUB_HINTS: Partial<Record<HubType, string>> = {
  dubai: 'UAE sourcing hub',
  china: 'Manufacturing & wholesale',
  bangladesh: 'Final delivery hub',
}

type HubDestinationPickerProps = {
  value: HubType
  onChange: (hub: HubType) => void
  hubs: HubType[]
}

export function HubDestinationPicker({ value, onChange, hubs }: HubDestinationPickerProps) {
  const theme = HUB_THEMES[value]

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 shadow-sm transition-all duration-300"
        style={{
          borderColor: theme.accent,
          backgroundColor: theme.accentSoft,
        }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold shadow-sm"
          style={{ backgroundColor: theme.accent, color: theme.accentForeground }}
        >
          {HUB_LABELS[value].charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Selected destination
          </p>
          <p className="text-lg font-bold leading-tight" style={{ color: theme.accent }}>
            {HUB_LABELS[value]} Hub
          </p>
          {HUB_HINTS[value] && (
            <p className="text-xs text-muted-foreground">{HUB_HINTS[value]}</p>
          )}
        </div>
        <MapPin className="h-5 w-5 shrink-0 opacity-70" style={{ color: theme.accent }} aria-hidden />
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Destination hub">
        {hubs.map((hub) => {
          const hubTheme = HUB_THEMES[hub]
          const selected = value === hub
          return (
            <button
              key={hub}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(hub)}
              className={cn(
                'relative flex flex-col items-center rounded-xl border-2 px-3 py-4 text-center transition-all duration-200',
                selected
                  ? 'scale-[1.02] shadow-md'
                  : 'border-border bg-card opacity-65 hover:border-muted-foreground/40 hover:opacity-100'
              )}
              style={
                selected
                  ? {
                      borderColor: hubTheme.accent,
                      backgroundColor: hubTheme.accentSoft,
                      boxShadow: `0 4px 14px ${hubTheme.accent}40`,
                    }
                  : undefined
              }
            >
              {selected && (
                <span
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: hubTheme.accent, color: hubTheme.accentForeground }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span
                className={cn(
                  'mb-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
                  !selected && 'bg-muted text-muted-foreground'
                )}
                style={
                  selected
                    ? { backgroundColor: hubTheme.accent, color: hubTheme.accentForeground }
                    : undefined
                }
              >
                {HUB_LABELS[hub].charAt(0)}
              </span>
              <p className="text-sm font-bold">{HUB_LABELS[hub]}</p>
              {HUB_HINTS[hub] && (
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{HUB_HINTS[hub]}</p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
