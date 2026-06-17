import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HandCoins } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShipmentItemStatusBadge } from '@/components/ShipmentItemStatusBadge'
import { ClientSettlementDialog } from '@/components/ClientSettlementDialog'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { BdCollectibleItem, ClientSettlement, ShipmentItem } from '@/types/database'

export function WarehouseSettlementsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [settleRow, setSettleRow] = useState<BdCollectibleItem | null>(null)
  const [settleItem, setSettleItem] = useState<ShipmentItem | null>(null)

  const isBd = profile?.hub === 'bangladesh'

  const { data: collectible } = useQuery({
    queryKey: ['bd-collectible-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_collectible_items')
        .select('*')
        .order('ready_at', { ascending: false })
      if (error) throw error
      return data as BdCollectibleItem[]
    },
    enabled: isBd,
  })

  const { data: settlements } = useQuery({
    queryKey: ['client-settlements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_settlements')
        .select('*, clients(name)')
        .order('settled_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as ClientSettlement[]
    },
    enabled: isBd,
  })

  if (!isBd) {
    return (
      <p className="text-sm text-muted-foreground">
        Client payment collection is handled at the Bangladesh hub.
      </p>
    )
  }

  const openCollect = async (row: BdCollectibleItem) => {
    const { data } = await supabase
      .from('shipment_items')
      .select('*, clients(name)')
      .eq('id', row.shipment_item_id)
      .single()
    setSettleItem(data as ShipmentItem)
    setSettleRow(row)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Client Collections</h2>
        <p className="text-sm text-muted-foreground">
          Products ready for pickup or delivery. Payment is calculated from client price, advance, and extra costs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ready for Collection</CardTitle>
        </CardHeader>
        <CardContent>
          {!collectible?.length ? (
            <p className="text-sm text-muted-foreground">
              No products ready yet. Receive items from shipments and mark them ready in Storage.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-semibold">Product</th>
                    <th className="pb-2 font-semibold">Client</th>
                    <th className="pb-2 font-semibold">Shipment</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold text-right">Collect</th>
                    <th className="pb-2 font-semibold text-right">Advance</th>
                    <th className="pb-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {collectible.map((p) => (
                    <tr key={p.shipment_item_id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{p.product_name}</td>
                      <td className="py-3 text-muted-foreground">{p.client_name ?? '—'}</td>
                      <td className="py-3 text-muted-foreground">{p.shipment_reference}</td>
                      <td className="py-3">
                        <ShipmentItemStatusBadge status={p.item_status} />
                      </td>
                      <td className="py-3 text-right font-data font-semibold">
                        {p.client_price != null
                          ? formatCurrency(p.client_price, p.currency ?? 'USD')
                          : '—'}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {p.advance_amount && p.advance_amount > 0
                          ? formatCurrency(p.advance_amount, p.currency ?? 'USD')
                          : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <Button size="sm" onClick={() => openCollect(p)}>
                          <HandCoins className="mr-1 h-4 w-4" /> Record
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Settlements</CardTitle>
        </CardHeader>
        <CardContent>
          {!settlements?.length ? (
            <p className="text-sm text-muted-foreground">No settlements recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {settlements.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div>
                    <p className="font-medium">{s.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.clients?.name ?? 'Client'} · {s.delivery_type} · {formatDateTime(s.settled_at)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-data font-semibold text-emerald-600">
                      Paid {formatCurrency(s.amount_paid, 'USD')}
                    </p>
                    {s.due_amount > 0 && (
                      <p className="text-amber-600">Due {formatCurrency(s.due_amount, 'USD')}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ClientSettlementDialog
        open={!!settleRow}
        onOpenChange={(open) => {
          if (!open) {
            setSettleRow(null)
            setSettleItem(null)
          }
        }}
        pricing={
          settleRow
            ? {
                id: settleRow.product_pricing_id ?? '',
                request_id: settleRow.request_id ?? '',
                item_index: 0,
                client_id: settleRow.client_id,
                product_name: settleRow.product_name,
                client_price: settleRow.client_price ?? 0,
                advance_amount: settleRow.advance_amount ?? 0,
                currency: settleRow.currency ?? 'USD',
              }
            : null
        }
        shipmentItem={settleItem}
        clientName={settleRow?.client_name ?? undefined}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['client-settlements'] })
          queryClient.invalidateQueries({ queryKey: ['bd-collectible-items'] })
          queryClient.invalidateQueries({ queryKey: ['bd-storage-items'] })
        }}
      />
    </div>
  )
}
