import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, PackageCheck, PackageX, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { ShipmentItemStatusBadge } from '@/components/ShipmentItemStatusBadge'
import { ClientSettlementDialog } from '@/components/ClientSettlementDialog'
import {
  BD_RECEIVABLE_STATUSES,
  SHIPMENT_ITEM_STATUS_LABELS,
} from '@/lib/constants'
import {
  markItemMissing,
  markItemReceivedAtBd,
  markItemReady,
} from '@/lib/bdItemFulfillment'
import { formatDateTime } from '@/lib/utils'
import type { BdProductPricing, ShipmentItem, ShipmentStatus } from '@/types/database'
import { useState } from 'react'

type BdShipmentReceivePanelProps = {
  shipmentId: string
  shipmentStatus: ShipmentStatus
  items: ShipmentItem[]
  canManage: boolean
}

export function BdShipmentReceivePanel({
  shipmentId,
  shipmentStatus,
  items,
  canManage,
}: BdShipmentReceivePanelProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [settleItem, setSettleItem] = useState<ShipmentItem | null>(null)
  const [settlePricing, setSettlePricing] = useState<BdProductPricing | null>(null)

  const showPanel =
    shipmentStatus === 'arrived_bangladesh' ||
    shipmentStatus === 'in_transit_to_bangladesh' ||
    items.some((i) => i.status !== 'in_transit' && i.status !== 'delivered')

  if (!showPanel) return null

  const received = items.filter((i) => !BD_RECEIVABLE_STATUSES.includes(i.status) && i.status !== 'in_transit').length
  const missing = items.filter((i) => i.status === 'missing').length
  const pending = items.filter((i) => BD_RECEIVABLE_STATUSES.includes(i.status)).length

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shipment-items', shipmentId] })
    queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] })
    queryClient.invalidateQueries({ queryKey: ['bd-storage-items'] })
    queryClient.invalidateQueries({ queryKey: ['bd-collectible-items'] })
    queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', 'bangladesh'] })
  }

  const receive = useMutation({
    mutationFn: (item: ShipmentItem) => markItemReceivedAtBd(item, user!.id),
    onSuccess: invalidate,
  })

  const missingMut = useMutation({
    mutationFn: (itemId: string) => markItemMissing(itemId),
    onSuccess: invalidate,
  })

  const ready = useMutation({
    mutationFn: ({ itemId, type }: { itemId: string; type: 'pickup' | 'delivery' }) =>
      markItemReady(itemId, type),
    onSuccess: invalidate,
  })

  const openSettlement = async (item: ShipmentItem) => {
    let pricing = item.product_pricing as BdProductPricing | null | undefined
    if (!pricing && item.product_pricing_id) {
      const { data } = await supabase
        .from('bd_product_pricing')
        .select('*')
        .eq('id', item.product_pricing_id)
        .maybeSingle()
      pricing = data as BdProductPricing | null
    }
    if (!pricing && item.procurement_request_id) {
      const { data } = await supabase
        .from('bd_product_pricing')
        .select('*')
        .eq('request_id', item.procurement_request_id)
      const match = data?.find(
        (p) => p.product_name.trim().toLowerCase() === item.name.trim().toLowerCase()
      )
      pricing = (match ?? data?.[0]) as BdProductPricing | null
    }
    setSettlePricing(pricing ?? null)
    setSettleItem(item)
  }

  const canReceive = canManage && shipmentStatus === 'arrived_bangladesh'

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Product Receipt & Fulfillment</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mark each product individually when the shipment arrives. Missing items are tracked separately.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span><strong>{received}</strong> received</span>
          <span className="text-amber-600"><strong>{pending}</strong> pending</span>
          {missing > 0 && <span className="text-red-600"><strong>{missing}</strong> missing</span>}
        </div>
      </div>

      <div className="divide-y">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.name}</p>
                <ShipmentItemStatusBadge status={item.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.quantity} {item.unit ?? 'pcs'}
                {item.weight_kg ? ` · ${item.weight_kg} kg` : ''}
                {item.clients?.name ? ` · ${item.clients.name}` : ''}
              </p>
              {item.received_at_bd && (
                <p className="text-[10px] text-muted-foreground">
                  Received {formatDateTime(item.received_at_bd)}
                </p>
              )}
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-1.5">
                {canReceive && BD_RECEIVABLE_STATUSES.includes(item.status) && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => receive.mutate(item)}
                      disabled={receive.isPending}
                    >
                      <PackageCheck className="mr-1 h-3.5 w-3.5" /> Received
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => missingMut.mutate(item.id)}
                      disabled={missingMut.isPending}
                    >
                      <PackageX className="mr-1 h-3.5 w-3.5" /> Missing
                    </Button>
                  </>
                )}
                {item.status === 'in_bd_storage' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => ready.mutate({ itemId: item.id, type: 'pickup' })}
                      disabled={ready.isPending}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Ready Pickup
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => ready.mutate({ itemId: item.id, type: 'delivery' })}
                      disabled={ready.isPending}
                    >
                      <Truck className="mr-1 h-3.5 w-3.5" /> Out for Delivery
                    </Button>
                  </>
                )}
                {(item.status === 'ready_for_pickup' || item.status === 'out_for_delivery') && (
                  <Button size="sm" onClick={() => openSettlement(item)}>
                    Delivered & Collect Payment
                  </Button>
                )}
                {item.status === 'delivered' && (
                  <span className="text-xs font-medium text-emerald-600">Settled</span>
                )}
                {item.status === 'missing' && (
                  <span className="text-xs font-medium text-red-600">
                    {SHIPMENT_ITEM_STATUS_LABELS.missing}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <ClientSettlementDialog
        open={!!settleItem}
        onOpenChange={(open) => {
          if (!open) {
            setSettleItem(null)
            setSettlePricing(null)
          }
        }}
        pricing={settlePricing}
        shipmentItem={settleItem}
        clientName={settleItem?.clients?.name}
        onSaved={invalidate}
      />
    </div>
  )
}
