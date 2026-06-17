import { supabase } from '@/lib/supabase'
import type { BdProductPricing, ShipmentItem } from '@/types/database'

export async function resolveProductPricingForItem(
  item: Pick<ShipmentItem, 'id' | 'name' | 'procurement_request_id' | 'product_pricing_id' | 'client_id'>
): Promise<BdProductPricing | null> {
  if (item.product_pricing_id) {
    const { data } = await supabase
      .from('bd_product_pricing')
      .select('*')
      .eq('id', item.product_pricing_id)
      .maybeSingle()
    return data as BdProductPricing | null
  }

  if (!item.procurement_request_id) return null

  const { data: rows } = await supabase
    .from('bd_product_pricing')
    .select('*')
    .eq('request_id', item.procurement_request_id)

  if (!rows?.length) return null

  const exact = rows.find(
    (r) => r.product_name.trim().toLowerCase() === item.name.trim().toLowerCase()
  )
  return (exact ?? rows[0]) as BdProductPricing
}

export async function markItemReceivedAtBd(
  item: ShipmentItem,
  actorId: string
): Promise<void> {
  const pricing = await resolveProductPricingForItem(item)
  const now = new Date().toISOString()

  const { data: inventory, error: invError } = await supabase
    .from('warehouse_inventory')
    .insert({
      hub: 'bangladesh',
      client_id: item.client_id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit ?? 'pcs',
      weight_kg: item.weight_kg,
      volume_cbm: item.volume_cbm,
      notes: item.notes,
      source_url: item.source_url,
      images: item.images ?? [],
      status: 'in_storage',
      shipment_id: item.shipment_id,
      shipment_item_id: item.id,
      added_by: actorId,
    })
    .select('id')
    .single()

  if (invError) throw invError

  const { error: itemError } = await supabase
    .from('shipment_items')
    .update({
      status: 'in_bd_storage',
      received_at_bd: now,
      product_pricing_id: pricing?.id ?? item.product_pricing_id,
      bd_inventory_id: inventory.id,
    })
    .eq('id', item.id)

  if (itemError) throw itemError
}

export async function markItemMissing(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('shipment_items')
    .update({
      status: 'missing',
      marked_missing_at: new Date().toISOString(),
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function markItemReady(
  itemId: string,
  deliveryType: 'pickup' | 'delivery'
): Promise<void> {
  const status = deliveryType === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery'
  const { error } = await supabase
    .from('shipment_items')
    .update({
      status,
      delivery_type: deliveryType,
      ready_at: new Date().toISOString(),
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function maybeCompleteShipment(shipmentId: string): Promise<void> {
  const { data: items } = await supabase
    .from('shipment_items')
    .select('status')
    .eq('shipment_id', shipmentId)

  if (!items?.length) return

  const allDone = items.every(
    (i) => i.status === 'delivered' || i.status === 'missing'
  )
  if (!allDone) return

  await supabase
    .from('shipments')
    .update({ status: 'delivered' })
    .eq('id', shipmentId)
}

export function calcSettlementAmounts(opts: {
  clientPrice: number
  advanceAmount: number
  applyAdvance: boolean
  extraCosts: { amount: number }[]
  amountPaid: number
}) {
  const extras = opts.extraCosts.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const advance = opts.applyAdvance ? opts.advanceAmount : 0
  const totalDue = Math.max(0, opts.clientPrice + extras - advance)
  const paid = opts.amountPaid
  const balance = Math.max(0, totalDue - paid)
  return { extras, advance, totalDue, balance }
}
