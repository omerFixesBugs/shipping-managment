const TRANSIT_DAYS: Record<string, number> = {
  sea: 21,
  air: 5,
}

export function getTransitDays(shippingMethod: string | null | undefined): number {
  return TRANSIT_DAYS[shippingMethod ?? 'sea'] ?? TRANSIT_DAYS.sea
}

export function getEstimatedArrivalDate(
  shipDate: string | null | undefined,
  shippingMethod: string | null | undefined
): Date | null {
  if (!shipDate) return null
  const base = new Date(shipDate)
  if (Number.isNaN(base.getTime())) return null
  const eta = new Date(base)
  eta.setDate(eta.getDate() + getTransitDays(shippingMethod))
  return eta
}

export function formatShippingMethod(method: string | null | undefined): string {
  if (method === 'air') return 'Air Freight'
  if (method === 'sea') return 'Sea Freight'
  return method ? method : 'Sea Freight'
}
