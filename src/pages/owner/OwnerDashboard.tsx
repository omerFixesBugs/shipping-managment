import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Package, ShoppingCart, TrendingUp, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS } from '@/lib/constants'
import type { Shipment, ShipmentPnl } from '@/types/database'

export function OwnerDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      const [shipmentsRes, procurementRes, pnlRes] = await Promise.all([
        supabase.from('shipments').select('id, status').neq('status', 'delivered'),
        supabase.from('procurement_requests').select('id').eq('status', 'quoted'),
        supabase.from('shipment_pnl').select('*'),
      ])
      const pnl = (pnlRes.data ?? []) as ShipmentPnl[]
      const monthlyProfit = pnl.reduce((sum, row) => sum + Number(row.profit), 0)
      const arrivals = (shipmentsRes.data ?? []).filter(
        (s: { status: string }) => s.status === 'arrived_bangladesh' || s.status === 'ready_for_pickup'
      ).length
      return {
        activeShipments: shipmentsRes.data?.length ?? 0,
        pendingQuotes: procurementRes.data?.length ?? 0,
        arrivals,
        monthlyProfit,
      }
    },
  })

  const { data: recentShipments } = useQuery({
    queryKey: ['recent-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, clients(name)')
        .order('updated_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as (Shipment & { clients: { name: string } })[]
    },
  })

  const kpis = [
    { label: 'Active Shipments', value: stats?.activeShipments ?? 0, icon: Truck },
    { label: 'Pending Quotes', value: stats?.pendingQuotes ?? 0, icon: ShoppingCart },
    { label: 'Arrivals (BD)', value: stats?.arrivals ?? 0, icon: Package },
    { label: 'Total P&L', value: formatCurrency(stats?.monthlyProfit ?? 0), icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/owner/procurement/new">New Procurement</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/owner/shipments/new">New Shipment</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{kpi.label}</CardTitle>
                <Icon className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium">Origin</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentShipments?.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link to={`/owner/shipments/${s.id}`} className="font-medium text-blue-600 hover:underline">
                        {s.reference_code}
                      </Link>
                    </td>
                    <td className="py-3">{s.clients?.name}</td>
                    <td className="py-3">{HUB_LABELS[s.origin_hub]}</td>
                    <td className="py-3">
                      <ShipmentStatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
                {!recentShipments?.length && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
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
  )
}
