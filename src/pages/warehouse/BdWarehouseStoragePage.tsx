import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Package, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ShipmentItemStatusBadge } from '@/components/ShipmentItemStatusBadge'
import { ClientSettlementDialog } from '@/components/ClientSettlementDialog'
import { cn } from '@/lib/utils'
import { markItemReady } from '@/lib/bdItemFulfillment'
import type { BdProductPricing, ShipmentItem } from '@/types/database'

type StorageTab = 'in_storage' | 'ready' | 'delivered'

type BdStorageRow = ShipmentItem & {
  clients: { name: string } | null
  shipments: { reference_code: string } | null
  product_pricing: BdProductPricing | null
}

export function BdWarehouseStoragePage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [tab, setTab] = useState<StorageTab>('in_storage')
  const [settleRow, setSettleRow] = useState<BdStorageRow | null>(null)

  const { data: items, isLoading } = useQuery({
    queryKey: ['bd-storage-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment_items')
        .select(
          '*, clients(name), shipments!inner(reference_code, current_hub), product_pricing:bd_product_pricing(client_price, advance_amount, currency, request_id, id)'
        )
        .eq('shipments.current_hub', 'bangladesh')
        .in('status', [
          'received_at_bd',
          'in_bd_storage',
          'ready_for_pickup',
          'out_for_delivery',
          'delivered',
        ])
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as BdStorageRow[]
    },
    enabled: !!user,
  })

  const visible = (items ?? []).filter((i) => {
    if (tab === 'in_storage') return i.status === 'in_bd_storage' || i.status === 'received_at_bd'
    if (tab === 'ready') return i.status === 'ready_for_pickup' || i.status === 'out_for_delivery'
    return i.status === 'delivered'
  })

  const readyMut = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'pickup' | 'delivery' }) => markItemReady(id, type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bd-storage-items'] }),
  })

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold">Bangladesh Storage</h2>
        <p className="text-xs text-muted-foreground">
          Products received from shipments stay here until pickup or delivery to the client.
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 gap-1 border-b px-4 py-3">
          {([
            { id: 'in_storage' as const, label: 'In Storage' },
            { id: 'ready' as const, label: 'Ready' },
            { id: 'delivered' as const, label: 'Delivered' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                tab === t.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {tab === 'in_storage'
                ? 'No products in storage. Receive items from an arrived shipment first.'
                : tab === 'ready'
                  ? 'Nothing ready for pickup or delivery yet.'
                  : 'No delivered products yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {visible.map((row) => {
                const pricing = row.product_pricing
                return (
                  <div key={row.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.name}</p>
                        <ShipmentItemStatusBadge status={row.status} />
                      </div>
                      <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.quantity} {row.unit ?? 'pcs'}
                      {row.weight_kg ? ` · ${row.weight_kg} kg` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.clients?.name ?? 'No client'} ·{' '}
                      <Link
                        to={`/warehouse/shipments/${row.shipment_id}`}
                        className="text-[var(--hub)] hover:underline"
                      >
                        {row.shipments?.reference_code}
                      </Link>
                    </p>
                    {pricing && (
                      <p className="text-xs">
                        Collect: <strong>{pricing.client_price} {pricing.currency}</strong>
                        {pricing.advance_amount > 0 && (
                          <span className="text-muted-foreground"> · Advance {pricing.advance_amount}</span>
                        )}
                      </p>
                    )}
                    {tab === 'in_storage' && (
                      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => readyMut.mutate({ id: row.id, type: 'pickup' })}
                        >
                          <Check className="mr-1 h-3 w-3" /> Ready Pickup
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => readyMut.mutate({ id: row.id, type: 'delivery' })}
                        >
                          <Truck className="mr-1 h-3 w-3" /> Out for Delivery
                        </Button>
                      </div>
                    )}
                    {tab === 'ready' && (
                      <Button size="sm" className="mt-auto" onClick={() => setSettleRow(row)}>
                        Delivered & Collect Payment
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <ClientSettlementDialog
        open={!!settleRow}
        onOpenChange={(open) => !open && setSettleRow(null)}
        pricing={
          settleRow?.product_pricing
            ? {
                ...settleRow.product_pricing,
                product_name: settleRow.name,
                client_id: settleRow.client_id,
              }
            : settleRow
              ? {
                  id: settleRow.product_pricing_id ?? '',
                  request_id: '',
                  item_index: 0,
                  client_id: settleRow.client_id,
                  product_name: settleRow.name,
                  client_price: 0,
                  advance_amount: 0,
                  currency: 'USD',
                }
              : null
        }
        shipmentItem={settleRow}
        clientName={settleRow?.clients?.name}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['bd-storage-items'] })
          queryClient.invalidateQueries({ queryKey: ['client-settlements'] })
        }}
      />
    </div>
  )
}
