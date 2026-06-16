import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCircle2, Package, Plus, ShoppingCart, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { ShipmentStatusBadge, ProcurementStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS } from '@/lib/constants'
import { cn, formatDateTime } from '@/lib/utils'
import type { ProcurementRequest, Shipment } from '@/types/database'

export function WarehouseDashboard() {
  const { profile } = useAuth()
  const hub = profile?.hub

  const { data: stats } = useQuery({
    queryKey: ['warehouse-stats', hub],
    queryFn: async () => {
      const [shipRes, procRes] = await Promise.all([
        supabase
          .from('shipments')
          .select('id, status')
          .or(`origin_hub.eq.${hub},current_hub.eq.${hub}`),
        supabase.from('procurement_requests').select('id, status').eq('target_hub', hub!),
      ])
      const ships = (shipRes.data ?? []) as Pick<Shipment, 'id' | 'status'>[]
      const procs = (procRes.data ?? []) as Pick<ProcurementRequest, 'id' | 'status'>[]
      return {
        active: ships.filter((s) => s.status !== 'delivered').length,
        ready: ships.filter(
          (s) => s.status === 'ready_for_pickup' || s.status === 'arrived_bangladesh'
        ).length,
        pendingProc: procs.filter((p) =>
          ['sent', 'approved', 'purchasing'].includes(p.status)
        ).length,
        readyToShip: procs.filter((p) => p.status === 'ready_to_ship').length,
      }
    },
    enabled: !!hub,
  })

  const { data: pendingProcurement } = useQuery({
    queryKey: ['warehouse-procurement', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*')
        .eq('target_hub', hub!)
        .in('status', ['sent', 'approved', 'purchasing'])
        .order('updated_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as ProcurementRequest[]
    },
    enabled: !!hub,
  })

  const { data: activeShipments } = useQuery({
    queryKey: ['warehouse-shipments', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name)')
        .or(`origin_hub.eq.${hub},current_hub.eq.${hub}`)
        .neq('status', 'delivered')
        .order('updated_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as (Shipment & { clients: { name: string } })[]
    },
    enabled: !!hub,
  })

  const { data: notifications } = useNotifications()
  const recentNotifications = notifications?.slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${hub ? HUB_LABELS[hub] : ''} Hub Operations`}
        description="Daily workload, inbound cargo, and procurement at your facility."
        actions={
          <Button asChild>
            <Link to="/warehouse/shipments/new">
              <Plus className="h-4 w-4" /> New Shipment
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Shipments" value={stats?.active ?? 0} icon={Truck} />
        <StatCard label="Ready / Arrived" value={stats?.ready ?? 0} icon={CheckCircle2} />
        <StatCard label="Open Procurement" value={stats?.pendingProc ?? 0} icon={ShoppingCart} />
        <StatCard
          label="Ready to Ship"
          value={stats?.readyToShip ?? 0}
          icon={Package}
          tone={stats?.readyToShip ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active Procurement</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/warehouse/procurement">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pendingProcurement?.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <Link
                    to={`/warehouse/procurement/${r.id}`}
                    className="font-medium hover:underline"
                    style={{ color: 'var(--hub)' }}
                  >
                    {r.title}
                  </Link>
                  <ProcurementStatusBadge status={r.status} />
                </li>
              ))}
              {!pendingProcurement?.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No active procurement requests.
                </p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active Shipments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/warehouse/shipments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {activeShipments?.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <Link
                      to={`/warehouse/shipments/${s.id}`}
                      className="font-data font-medium hover:underline"
                      style={{ color: 'var(--hub)' }}
                    >
                      {s.reference_code}
                    </Link>
                    <p className="text-xs text-muted-foreground">{s.clients?.name ?? '—'}</p>
                  </div>
                  <ShipmentStatusBadge status={s.status} />
                </li>
              ))}
              {!activeShipments?.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No active shipments.
                </p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)] lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" style={{ color: 'var(--hub)' }} />
              <CardTitle className="text-base">Recent Notifications</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/notifications">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentNotifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentNotifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg p-3',
                      !n.read && 'bg-accent/50'
                    )}
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: n.read ? 'transparent' : 'var(--hub)' }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDateTime(n.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
