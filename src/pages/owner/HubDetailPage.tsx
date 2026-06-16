import { Link, useParams, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Boxes, ChevronRight, Package, Truck, User, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS, HUB_THEMES } from '@/lib/constants'
import type { HubType, Profile, ShipmentStatus } from '@/types/database'

const HUBS: HubType[] = ['dubai', 'china', 'bangladesh']

type HubManager = Pick<Profile, 'id' | 'full_name' | 'position' | 'phone'>

type InventoryRow = {
  id: string
  name: string
  quantity: number
  unit: string | null
  shipments: {
    reference_code: string
    status: ShipmentStatus
  } | null
}

export function HubDetailPage() {
  const { hubId } = useParams()
  const hub = hubId as HubType

  const { data: inventory } = useQuery({
    queryKey: ['hub-inventory', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_items')
        .select('id, name, quantity, unit, shipments!inner(reference_code, status, current_hub)')
        .eq('shipments.current_hub', hub)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as InventoryRow[]
    },
    enabled: HUBS.includes(hub),
  })

  const { data: personnel } = useQuery({
    queryKey: ['hub-personnel', hub],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, position, phone')
        .eq('role', 'warehouse_manager')
        .eq('hub', hub)
        .order('full_name')
      if (error) throw error
      return data as HubManager[]
    },
    enabled: HUBS.includes(hub),
  })

  if (!HUBS.includes(hub)) {
    return <Navigate to="/owner/hubs" replace />
  }

  const theme = HUB_THEMES[hub]
  const totalUnits = inventory?.reduce((sum, i) => sum + Number(i.quantity), 0) ?? 0
  const distinctShipments = new Set(
    inventory?.map((i) => i.shipments?.reference_code).filter(Boolean)
  ).size

  return (
    <div
      className="space-y-6"
      style={{ ['--hub' as string]: theme.accent }}
    >
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/owner/hubs" className="hover:text-foreground">
          Warehouse Hubs
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{HUB_LABELS[hub]} Hub</span>
      </nav>

      <PageHeader
        title={`${HUB_LABELS[hub]} — Inventory & Personnel`}
        description="Cargo currently held at this facility and on-site staff."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Distinct Items" value={inventory?.length ?? 0} icon={Boxes} />
        <StatCard label="Total Units" value={totalUnits} mono icon={Package} />
        <StatCard label="Open Shipments" value={distinctShipments} icon={Truck} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Inventory */}
        <Card className="shadow-[var(--shadow-card)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Inventory Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-3 font-semibold">Product</th>
                    <th className="px-2 py-3 font-semibold">Qty</th>
                    <th className="px-2 py-3 font-semibold">Shipment</th>
                    <th className="px-2 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory?.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-2 py-3 font-medium">{item.name}</td>
                      <td className="px-2 py-3 font-data">
                        {item.quantity} {item.unit ?? ''}
                      </td>
                      <td className="px-2 py-3 font-data text-muted-foreground">
                        {item.shipments?.reference_code ?? '—'}
                      </td>
                      <td className="px-2 py-3">
                        {item.shipments?.status ? (
                          <ShipmentStatusBadge status={item.shipments.status} />
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {!inventory?.length && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-muted-foreground">
                        No cargo currently at this hub.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Personnel */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-4 w-4" style={{ color: theme.accent }} />
            <CardTitle className="text-base">Personnel On-Site</CardTitle>
          </CardHeader>
          <CardContent>
            {personnel?.length ? (
              <ul className="space-y-3">
                {personnel.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: theme.accent }}
                    >
                      <User className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.position ?? 'Hub Manager'}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No personnel assigned to this hub.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
