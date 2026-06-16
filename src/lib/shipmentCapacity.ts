export function sumLineTotals(
  lines: { quantity?: number | null; weight_kg?: number | null; volume_cbm?: number | null }[]
): { weight: number; volume: number; quantity: number } {
  return lines.reduce<{ weight: number; volume: number; quantity: number }>(
    (acc, l) => ({
      weight: acc.weight + (Number(l.weight_kg) || 0),
      volume: acc.volume + (Number(l.volume_cbm) || 0),
      quantity: acc.quantity + (Number(l.quantity) || 0),
    }),
    { weight: 0, volume: 0, quantity: 0 }
  )
}

export function wouldExceedCapacity(
  limits: { maxWeight?: number | null; maxVolume?: number | null; maxQty?: number | null },
  current: { weight: number; volume: number; quantity: number },
  adding: { weight: number; volume: number; quantity: number }
): string | null {
  if (limits.maxWeight != null && limits.maxWeight > 0 && current.weight + adding.weight > limits.maxWeight) {
    return `Exceeds max weight (${limits.maxWeight} kg). Would be ${(current.weight + adding.weight).toFixed(2)} kg.`
  }
  if (limits.maxVolume != null && limits.maxVolume > 0 && current.volume + adding.volume > limits.maxVolume) {
    return `Exceeds max volume (${limits.maxVolume} CBM). Would be ${(current.volume + adding.volume).toFixed(3)} CBM.`
  }
  if (limits.maxQty != null && limits.maxQty > 0 && current.quantity + adding.quantity > limits.maxQty) {
    return `Exceeds max item count (${limits.maxQty}). Would be ${current.quantity + adding.quantity} pcs.`
  }
  return null
}
