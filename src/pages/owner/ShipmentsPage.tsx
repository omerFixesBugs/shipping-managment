import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS, SHIPMENT_STATUS_LABELS } from '@/lib/constants'
import type { HubType, Shipment, ShipmentStatus } from '@/types/database'

export function ShipmentsPage() {
  const [hubFilter, setHubFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['shipments', hubFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('shipments')
        .select('*, clients(name)')
        .order('updated_at', { ascending: false })

      if (hubFilter !== 'all') {
        query = query.or(`origin_hub.eq.${hubFilter},current_hub.eq.${hubFilter}`)
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (Shipment & { clients: { name: string } })[]
    },
  })

  const filtered = shipments?.filter(
    (s) =>
      !search ||
      s.reference_code.toLowerCase().includes(search.toLowerCase()) ||
      s.clients?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Shipments</h2>
        <Button asChild>
          <Link to="/owner/shipments/new">New Shipment</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search reference or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={hubFilter} onValueChange={setHubFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Hub" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hubs</SelectItem>
            {(['dubai', 'china', 'bangladesh'] as HubType[]).map((h) => (
              <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Origin</th>
                  <th className="pb-3 font-medium">Current Hub</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link to={`/owner/shipments/${s.id}`} className="font-medium text-blue-600 hover:underline">
                        {s.reference_code}
                      </Link>
                    </td>
                    <td className="py-3">{s.clients?.name}</td>
                    <td className="py-3 capitalize">{s.type.replace('_', ' ')}</td>
                    <td className="py-3">{HUB_LABELS[s.origin_hub]}</td>
                    <td className="py-3">{HUB_LABELS[s.current_hub]}</td>
                    <td className="py-3">
                      <ShipmentStatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
                {!filtered?.length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No shipments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
