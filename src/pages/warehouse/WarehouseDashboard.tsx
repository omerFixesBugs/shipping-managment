import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShipmentStatusBadge, ProcurementStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { ProcurementRequest, Shipment } from '@/types/database'

export function WarehouseDashboard() {
  const { profile } = useAuth()
  const hub = profile?.hub

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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {hub ? HUB_LABELS[hub] : ''} Hub Dashboard
        </h2>
        <Button asChild size="sm">
          <Link to="/warehouse/shipments/new">
            <Plus className="mr-1 h-4 w-4" /> New Shipment
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Procurement</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pendingProcurement?.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <Link to={`/warehouse/procurement/${r.id}`} className="font-medium hover:underline" style={{ color: 'var(--hub)' }}>
                    {r.title}
                  </Link>
                  <ProcurementStatusBadge status={r.status} />
                </li>
              ))}
              {!pendingProcurement?.length && (
                <p className="text-muted-foreground text-sm">No active procurement requests.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {activeShipments?.map((s) => (
                <li key={s.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <Link to={`/warehouse/shipments/${s.id}`} className="font-medium hover:underline" style={{ color: 'var(--hub)' }}>
                      {s.reference_code}
                    </Link>
                    <p className="text-xs text-muted-foreground">{s.clients?.name}</p>
                  </div>
                  <ShipmentStatusBadge status={s.status} />
                </li>
              ))}
              {!activeShipments?.length && (
                <p className="text-muted-foreground text-sm">No active shipments.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Notifications panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Notifications</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/notifications">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
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
