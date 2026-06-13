import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShipmentStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import type { Shipment, ShipmentEvent } from '@/types/database'

export function ClientPortal() {
  const { data: shipments, isLoading } = useQuery({
    queryKey: ['client-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Shipment[]
    },
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">My Shipments</h2>
      <p className="text-slate-500">
        Track your shipments across Dubai, China, and Bangladesh hubs.
      </p>

      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="grid gap-4">
          {shipments?.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  <Link to={`/client/shipments/${s.id}`} className="text-blue-600 hover:underline">
                    {s.reference_code}
                  </Link>
                </CardTitle>
                <ShipmentStatusBadge status={s.status} />
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <p>Origin: {HUB_LABELS[s.origin_hub]}</p>
                <p>Current: {HUB_LABELS[s.current_hub]}</p>
                {s.description && <p>{s.description}</p>}
                {(s.status === 'ready_for_pickup' || s.status === 'arrived_bangladesh') && (
                  <p className="mt-2 font-medium text-emerald-600">
                    Your goods are at the Bangladesh warehouse and ready for pickup or delivery.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {!shipments?.length && (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No shipments linked to your account yet.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export function ClientShipmentDetail() {
  const { id } = useParams()

  const { data: shipment } = useQuery({
    queryKey: ['client-shipment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Shipment
    },
    enabled: !!id,
  })

  const { data: events } = useQuery({
    queryKey: ['client-shipment-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ShipmentEvent[]
    },
    enabled: !!id,
  })

  if (!shipment) return <p className="text-slate-500">Loading...</p>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{shipment.reference_code}</h2>
        <ShipmentStatusBadge status={shipment.status} />
      </div>

      {(shipment.status === 'ready_for_pickup' || shipment.status === 'arrived_bangladesh') && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6">
            <p className="font-medium text-emerald-800">
              Your goods have arrived at our Bangladesh warehouse and are ready for pickup or delivery.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Tracking Timeline</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {events?.map((e) => (
              <li key={e.id} className="flex gap-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                <div>
                  <p className="text-sm font-medium capitalize">{e.to_status.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(e.created_at)}</p>
                </div>
              </li>
            ))}
            {!events?.length && <p className="text-slate-500">No tracking events yet.</p>}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
