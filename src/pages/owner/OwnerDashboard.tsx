import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  Package,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import {
  HUB_LABELS,
  SHIPMENT_STATUS_LABELS,
} from '@/lib/constants'
import type {
  HubType,
  ProcurementRequest,
  Shipment,
  ShipmentEvent,
  ShipmentPnl,
} from '@/types/database'

const HUBS: HubType[] = ['dubai', 'china', 'bangladesh']

export function OwnerDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      const [shipmentsRes, procurementRes, pnlRes] = await Promise.all([
        supabase.from('shipments').select('id, status, current_hub, origin_hub'),
        supabase.from('procurement_requests').select('id, status'),
        supabase.from('shipment_pnl').select('*'),
      ])
      const shipments = (shipmentsRes.data ?? []) as Pick<
        Shipment,
        'id' | 'status' | 'current_hub' | 'origin_hub'
      >[]
      const procurement = (procurementRes.data ?? []) as Pick<
        ProcurementRequest,
        'id' | 'status'
      >[]
      const pnl = (pnlRes.data ?? []) as ShipmentPnl[]

      const active = shipments.filter((s) => s.status !== 'delivered')
      const inTransit = shipments.filter(
        (s) => s.status === 'in_transit_to_bangladesh'
      ).length
      const activeProcurement = procurement.filter(
        (p) => !['rejected', 'ready_to_ship'].includes(p.status)
      ).length
      const pendingApprovals = procurement.filter((p) => p.status === 'quoted').length
      const revenue = pnl.reduce((sum, r) => sum + Number(r.revenue), 0)
      const profit = pnl.reduce((sum, r) => sum + Number(r.profit), 0)

      const byHub = HUBS.map((hub) => ({
        hub,
        active: active.filter((s) => s.current_hub === hub).length,
      }))

      return {
        activeProcurement,
        inTransit,
        activeShipments: active.length,
        pendingApprovals,
        revenue,
        profit,
        byHub,
      }
    },
  })

  const { data: priorityApprovals } = useQuery({
    queryKey: ['owner-priority-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*)')
        .eq('status', 'quoted')
        .order('updated_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as ProcurementRequest[]
    },
  })

  const { data: activity } = useQuery({
    queryKey: ['owner-activity-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*, shipments(reference_code)')
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data as (ShipmentEvent & { shipments: { reference_code: string } | null })[]
    },
  })

  const { data: recentShipments } = useQuery({
    queryKey: ['recent-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name)')
        .order('updated_at', { ascending: false })
        .limit(6)
      if (error) throw error
      return data as (Shipment & { clients: { name: string } })[]
    },
  })

  const maxHubActive = Math.max(1, ...(stats?.byHub.map((h) => h.active) ?? [1]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Overview"
        description="Real-time telemetry and performance metrics across global hubs."
        actions={
          <>
            <Button asChild>
              <Link to="/owner/procurement/new">
                <ShoppingCart className="h-4 w-4" /> New Request
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/owner/shipments/new">
                <Truck className="h-4 w-4" /> New Shipment
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Sourcing"
          value={stats?.activeProcurement ?? 0}
          icon={ShoppingCart}
          hint="procurement requests open"
        />
        <StatCard
          label="Shipments in Transit"
          value={stats?.inTransit ?? 0}
          icon={Truck}
          hint={`${stats?.activeShipments ?? 0} active total`}
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats?.revenue ?? 0)}
          icon={DollarSign}
          mono
          trend={
            (stats?.profit ?? 0) >= 0
              ? { value: `${formatCurrency(stats?.profit ?? 0)} profit`, direction: 'up' }
              : { value: `${formatCurrency(stats?.profit ?? 0)} loss`, direction: 'down' }
          }
        />
        <StatCard
          label="Pending Approvals"
          value={stats?.pendingApprovals ?? 0}
          icon={CheckCircle2}
          tone={stats?.pendingApprovals ? 'warning' : 'default'}
          hint="quotes awaiting decision"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: hub activity + recent shipments */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Hub Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats?.byHub.map(({ hub, active }) => (
                <div key={hub} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <Link
                      to="/owner/hubs"
                      className="font-medium hover:underline"
                    >
                      {HUB_LABELS[hub]}
                    </Link>
                    <span className="font-data text-muted-foreground">
                      {active} active
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[var(--color-brand)]"
                      style={{ width: `${(active / maxHubActive) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Shipments</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/owner/shipments">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 font-semibold">Reference</th>
                      <th className="pb-3 font-semibold">Client</th>
                      <th className="pb-3 font-semibold">Route</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentShipments?.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-3">
                          <Link
                            to={`/owner/shipments/${s.id}`}
                            className="font-data font-medium text-[var(--color-brand)] hover:underline"
                          >
                            {s.reference_code}
                          </Link>
                        </td>
                        <td className="py-3">{s.clients?.name ?? '—'}</td>
                        <td className="py-3 text-muted-foreground">
                          {HUB_LABELS[s.origin_hub]} → {HUB_LABELS[s.current_hub]}
                        </td>
                        <td className="py-3">
                          <ShipmentStatusBadge status={s.status} />
                        </td>
                      </tr>
                    ))}
                    {!recentShipments?.length && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          No shipments yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: priority approvals + live activity */}
        <div className="space-y-6">
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Priority Approvals</CardTitle>
              {priorityApprovals?.length ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {priorityApprovals.length} urgent
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {priorityApprovals?.map((req) => {
                const quote = req.quotes?.[0]
                return (
                  <Link
                    key={req.id}
                    to={`/owner/procurement/${req.id}`}
                    className="block rounded-lg border p-3 transition-colors hover:border-[var(--color-brand)] hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{req.title}</p>
                      {quote ? (
                        <span className="font-data text-sm font-semibold">
                          {formatCurrency(Number(quote.total_cost), quote.currency)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {HUB_LABELS[req.target_hub]} · awaiting approval
                    </p>
                  </Link>
                )
              })}
              {!priorityApprovals?.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No quotes awaiting approval.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--color-brand)]" />
              <CardTitle className="text-base">Live Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {activity?.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)] dark:bg-blue-950/40">
                      <Package className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-data font-medium">
                          {e.shipments?.reference_code ?? 'Shipment'}
                        </span>{' '}
                        → {SHIPMENT_STATUS_LABELS[e.to_status]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(e.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
                {!activity?.length && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No recent activity.
                  </p>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
