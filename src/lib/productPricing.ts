import { supabase } from '@/lib/supabase'
import type { ProcurementItem, ProcurementRequestMode } from '@/types/database'

export type ProductPricingInput = {
  itemIndex: number
  productName: string
  purchaseCost: number | null
  clientPrice: number
  advanceAmount: number
  currency?: string
}

export async function syncProductPricing(
  requestId: string,
  clientId: string | null,
  items: ProcurementItem[],
  pricing: ProductPricingInput[]
) {
  const rows = items.map((item, itemIndex) => {
    const p = pricing.find((x) => x.itemIndex === itemIndex)
    return {
      request_id: requestId,
      item_index: itemIndex,
      client_id: clientId,
      product_name: item.name,
      purchase_cost: p?.purchaseCost ?? null,
      client_price: p?.clientPrice ?? 0,
      advance_amount: p?.advanceAmount ?? 0,
      currency: p?.currency ?? 'USD',
    }
  })

  if (!rows.length) return

  const { error } = await supabase.from('product_pricing').upsert(rows, {
    onConflict: 'request_id,item_index',
  })
  if (error) throw error
}

export const REQUEST_MODE_LABELS: Record<ProcurementRequestMode, string> = {
  sourced: 'Sourced — Quote & Approve',
  direct_buy: 'Direct Buy — Hub Quotes, Owner Approves',
}

export const REQUEST_MODE_HINTS: Record<ProcurementRequestMode, string> = {
  sourced:
    'No pricing on request. Hub quotes buy cost per product. Owner sets client price when approving.',
  direct_buy:
    'No pricing on request. Hub quotes buy cost. Owner sets client price on approval, then hub purchases.',
}

export function hubSkipsQuote(_mode: ProcurementRequestMode | undefined) {
  return false
}
