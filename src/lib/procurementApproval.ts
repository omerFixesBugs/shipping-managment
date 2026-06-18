import { supabase } from '@/lib/supabase'
import { syncProductPricing, type ProductPricingInput } from '@/lib/productPricing'
import type { ProcurementItem, ProcurementRequest } from '@/types/database'

export async function upsertSingleProductPricing(
  requestId: string,
  clientId: string | null,
  item: ProcurementItem,
  itemIndex: number,
  input: {
    purchaseCost: number | null
    clientPrice: number
    advanceAmount: number
    currency?: string
  }
) {
  const { error } = await supabase.from('product_pricing').upsert(
    {
      request_id: requestId,
      item_index: itemIndex,
      client_id: clientId,
      product_name: item.name,
      purchase_cost: input.purchaseCost,
      client_price: input.clientPrice,
      advance_amount: input.advanceAmount,
      currency: input.currency ?? 'USD',
    },
    { onConflict: 'request_id,item_index' }
  )
  if (error) throw error
}

export async function fetchProductPricingMap(requestId: string) {
  const { data, error } = await supabase
    .from('product_pricing')
    .select('*')
    .eq('request_id', requestId)
  if (error) throw error
  const map = new Map<number, { clientPrice: number; advanceAmount: number }>()
  for (const row of data ?? []) {
    map.set(row.item_index, {
      clientPrice: Number(row.client_price) || 0,
      advanceAmount: Number(row.advance_amount) || 0,
    })
  }
  return map
}

export async function approveProcurementRequest({
  requestId,
  userId,
  request,
  quoteId,
  pricingInputs,
}: {
  requestId: string
  userId: string
  request: ProcurementRequest
  quoteId?: string
  pricingInputs: ProductPricingInput[]
}) {
  if (pricingInputs.some((p) => !p.clientPrice || p.clientPrice <= 0)) {
    throw new Error('Set a client price for every product before approving.')
  }

  const { error: reqError } = await supabase
    .from('procurement_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
  if (reqError) throw reqError

  if (quoteId) {
    await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quoteId)
  }

  await syncProductPricing(requestId, request.client_id, request.items, pricingInputs)

  const totalAdvance = pricingInputs.reduce((s, p) => s + (p.advanceAmount || 0), 0)
  if (totalAdvance > 0) {
    await supabase.from('financial_entries').insert({
      shipment_id: null,
      procurement_request_id: requestId,
      category: 'advance_payment',
      amount: totalAdvance,
      currency: 'USD',
      description: `Client advance: ${request.title}`,
      entry_date: new Date().toISOString().split('T')[0],
      created_by: userId,
    })
  }

  await supabase.functions.invoke('shipment-status', {
    body: { type: 'procurement_status', requestId, newStatus: 'approved' },
  })
}

export async function rejectProcurementRequest(requestId: string, quoteId?: string) {
  const { error: reqError } = await supabase
    .from('procurement_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
  if (reqError) throw reqError

  if (quoteId) {
    await supabase.from('quotes').update({ status: 'rejected' }).eq('id', quoteId)
  }

  await supabase.functions.invoke('shipment-status', {
    body: { type: 'procurement_status', requestId, newStatus: 'rejected' },
  })
}
