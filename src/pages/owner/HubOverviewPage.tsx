import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Boxes, Mail, MapPin, Phone, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { HUB_LABELS, HUB_THEMES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { HubType, Profile, Shipment } from '@/types/database'

const HUBS: HubType[] = ['dubai', 'china', 'bangladesh']

const HUB_LOCATION: Record<HubType, string> = {
  dubai: 'Jebel Ali Free Zone, Dubai, UAE',
  china: 'Yantian Port District, Shenzhen, China',
  bangladesh: 'DEPZ Area, Savar, Dhaka, Bangladesh',
}

type HubManager = Pick<Profile, 'id' | 'full_name' | 'position' | 'phone' | 'hub'>

export function HubOverviewPage() {
  const { data: shipments } = useQuery({
    queryKey: ['hub-overview-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('id, status, current_hub, origin_hub')
      if (error) throw error
      return data as Pick<Shipment, 'id' | 'status' | 'current_hub' | 'origin_hub'>[]
    },
  })

  const { data: managers } = useQuery({
    queryKey: ['hub-managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, position, phone, hub')
        .eq('role', 'warehouse_manager')
        .order('full_name')
      if (error) throw error
      return data as HubManager[]
    },
  })

  const totalActive =
    shipments?.filter((s) => s.status !== 'delivered').length ?? 0
  const delivered = shipments?.filter((s) => s.status === 'delivered').length ?? 0
  const efficiency =
    shipments?.length ? Math.round((delivered / shipments.length) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hub Management"
        description="Global overview of all active warehouse facilities."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Shipments" value={totalActive} icon={Boxes} hint="across all hubs" />
        <StatCard label="Operational Hubs" value={HUBS.length} icon={MapPin} hint="Dubai · China · Dhaka" />
        <StatCard
          label="Delivery Efficiency"
          value={`${efficiency}%`}
          mono
          trend={{ value: `${delivered} delivered`, direction: 'up' }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {HUBS.map((hub) => {
          const theme = HUB_THEMES[hub]
          const hubShipments = shipments?.filter((s) => s.current_hub === hub) ?? []
          const active = hubShipments.filter((s) => s.status !== 'delivered').length
          const hubManagers = managers?.filter((m) => m.hub === hub) ?? []
          const isBusy = active >= 8
          return (
            <Card key={hub} className="flex flex-col overflow-hidden shadow-[var(--shadow-card)]">
              {/* Banner */}
              <div
                className="relative p-5 text-white"
                style={{ backgroundColor: theme.accent }}
              >
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {hub === 'bangladesh' ? 'Destination' : 'Origin'}
                </span>
                <h3 className="mt-2 text-lg font-bold">{HUB_LABELS[hub]} Hub</h3>
                <p className="text-xs text-white/80">{HUB_LOCATION[hub]}</p>
              </div>

              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Active Shipments</p>
                    <p className="font-data text-xl font-bold">{active}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Total Handled</p>
                    <p className="font-data text-xl font-bold">{hubShipments.length}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hub Personnel
                  </p>
                  {hubManagers.length ? (
                    <ul className="space-y-2">
                      {hubManagers.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-sm">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: theme.accent }}
                          >
                            <User className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {m.position ?? 'Hub Manager'}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No manager assigned.</p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between border-t pt-4">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-semibold',
                      isBusy ? 'text-amber-600' : 'text-emerald-600'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        isBusy ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                    />
                    {isBusy ? 'High Load' : 'Operational'}
                  </span>
                  <Link
                    to={`/owner/hubs/${hub}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    View Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Contact directory */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Manager Directory
          </p>
          {managers?.length ? (
            <ul className="divide-y">
              {managers.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2.5 text-sm">
                  <span className="w-40 font-medium">{m.full_name}</span>
                  <span className="text-muted-foreground">{m.hub ? HUB_LABELS[m.hub] : '—'}</span>
                  {m.phone ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {m.phone}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {m.position ?? 'Hub Manager'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No managers found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
