import { useMemo, useState } from 'react'
import { Check, Search, User, UserPlus, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AddClientDialog } from '@/components/AddClientDialog'
import type { Client } from '@/types/database'

export type ClientOption = Pick<Client, 'id' | 'name' | 'phone' | 'email'>

type ClientPickerProps = {
  value: string | null
  onChange: (clientId: string | null) => void
  clients: ClientOption[]
  allowNone?: boolean
  noneLabel?: string
  noneDescription?: string
  className?: string
}

export function ClientPicker({
  value,
  onChange,
  clients,
  allowNone = true,
  noneLabel = 'None — multi-client',
  noneDescription = 'Products can be split across clients later',
  className,
}: ClientPickerProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = clients.find((c) => c.id === value) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false)
    )
  }, [clients, search])

  const pick = (clientId: string | null) => {
    onChange(clientId)
    setSearchOpen(false)
    setSearch('')
  }

  const openSearch = () => {
    setSearch('')
    setSearchOpen(true)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[selected.phone, selected.email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={openSearch}>
              Change
            </Button>
            {allowNone && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => onChange(null)}
                aria-label="Clear client"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 justify-start gap-2 text-muted-foreground"
            onClick={openSearch}
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search clients…</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            New
          </Button>
        </div>
      )}

      <Dialog
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open)
          if (!open) setSearch('')
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
            <DialogTitle>Select client</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Search by name, phone, or email — works well with large client lists.
            </p>
          </DialogHeader>

          <div className="border-b px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to filter…"
                className="h-10 pl-9"
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
              {search.trim() ? ` matching “${search.trim()}”` : ''}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {allowNone && (
              <button
                type="button"
                onClick={() => pick(null)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                  !value && 'bg-muted/40'
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Users className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{noneLabel}</p>
                  <p className="text-xs text-muted-foreground">{noneDescription}</p>
                </div>
                {!value && <Check className="h-4 w-4 shrink-0 text-[var(--color-brand)]" />}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">No clients match your search.</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    setSearchOpen(false)
                    setAddOpen(true)
                  }}
                >
                  Add a new client
                </Button>
              </div>
            ) : (
              filtered.map((client) => {
                const isSelected = value === client.id
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => pick(client.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                      isSelected && 'bg-[var(--color-brand)]/8'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        isSelected
                          ? 'bg-[var(--color-brand)] text-white'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[client.phone, client.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--color-brand)]" />}
                  </button>
                )
              })
            )}
          </div>

          <div className="border-t bg-muted/20 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                setSearchOpen(false)
                setAddOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Add new client
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddClientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(client) => pick(client.id)}
      />
    </div>
  )
}
