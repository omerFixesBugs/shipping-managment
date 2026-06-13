import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProcurementStatusBadge } from '@/components/StatusBadge'
import { HUB_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { ProcurementRequest } from '@/types/database'

export function ProcurementPage() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ProcurementRequest[]
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Procurement</h2>
        <Button asChild>
          <Link to="/owner/procurement/new">New Request</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Hub</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Items</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {requests?.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link to={`/owner/procurement/${r.id}`} className="font-medium text-blue-600 hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="py-3">{HUB_LABELS[r.target_hub]}</td>
                    <td className="py-3">
                      <ProcurementStatusBadge status={r.status} />
                    </td>
                    <td className="py-3">{r.items?.length ?? 0}</td>
                    <td className="py-3">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
                {!requests?.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No procurement requests yet.
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
