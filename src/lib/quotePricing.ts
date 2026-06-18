export type QuoteBreakdownLine = {
  type: string
  item: string
  quantity: number
  unitPrice: number
  cost: number
  /** Links packaging / freight lines to a product row. */
  itemIndex?: number
}

export type ProductCostBreakdown = {
  productCost: number
  packagingCost: number
  shippingCost: number
  otherCost: number
  /** @deprecated use packagingCost + shippingCost + otherCost */
  sharedCostShare: number
  totalCost: number
  detailLines: { label: string; cost: number; type: string }[]
}

function lineCost(line: QuoteBreakdownLine | undefined) {
  return line ? Number(line.cost) || 0 : 0
}

function productItemLine(
  breakdown: QuoteBreakdownLine[],
  item: { name: string },
  index: number
) {
  const indexed = breakdown.find((b) => b.type === 'item' && b.itemIndex === index)
  if (indexed) return indexed
  const productLines = breakdown.filter((b) => b.type === 'item')
  return (
    productLines[index] ??
    productLines.find((p) => p.item.trim().toLowerCase() === item.name.trim().toLowerCase())
  )
}

function ancillaryCost(
  breakdown: QuoteBreakdownLine[],
  type: string,
  itemIndex: number,
  itemCount: number
) {
  const tagged = breakdown.filter((b) => b.type === type && b.itemIndex === itemIndex)
  if (tagged.length) return tagged.reduce((s, b) => s + lineCost(b), 0)

  const legacy = breakdown.filter((b) => b.type === type && b.itemIndex == null)
  if (!legacy.length || itemCount === 0) return 0
  const legacyTotal = legacy.reduce((s, b) => s + lineCost(b), 0)
  return legacyTotal / itemCount
}

export function buildProductCostsFromQuote(
  items: { name: string }[],
  breakdown: QuoteBreakdownLine[]
): ProductCostBreakdown[] {
  return items.map((item, i) => {
    const itemLine = productItemLine(breakdown, item, i)
    const productCost = lineCost(itemLine)
    const packagingCost = ancillaryCost(breakdown, 'packaging', i, items.length)
    const shippingCost = ancillaryCost(breakdown, 'shipping', i, items.length)
    const otherCost = ancillaryCost(breakdown, 'other', i, items.length)
    const ancillary = packagingCost + shippingCost + otherCost
    const detailLines = [
      ...(itemLine ? [{ label: itemLine.item, cost: productCost, type: 'item' as const }] : []),
      ...(packagingCost > 0 ? [{ label: 'Packaging', cost: packagingCost, type: 'packaging' as const }] : []),
      ...(shippingCost > 0 ? [{ label: 'Shipping / freight', cost: shippingCost, type: 'shipping' as const }] : []),
      ...(otherCost > 0 ? [{ label: 'Other', cost: otherCost, type: 'other' as const }] : []),
    ]
    return {
      productCost,
      packagingCost,
      shippingCost,
      otherCost,
      sharedCostShare: ancillary,
      totalCost: productCost + ancillary,
      detailLines,
    }
  })
}

export function productQuotesToBreakdown(
  blocks: {
    itemIndex: number
    productName: string
    quantity: number
    unitPrice: string
    packagingPrice: string
    shippingPrice: string
  }[]
): QuoteBreakdownLine[] {
  return blocks.flatMap((block) => {
    const unitPrice = parseFloat(block.unitPrice) || 0
    const packaging = parseFloat(block.packagingPrice) || 0
    const shipping = parseFloat(block.shippingPrice) || 0
    return [
      {
        type: 'item',
        item: block.productName,
        quantity: block.quantity,
        unitPrice,
        cost: unitPrice * block.quantity,
        itemIndex: block.itemIndex,
      },
      {
        type: 'packaging',
        item: `${block.productName} — packaging`,
        quantity: 1,
        unitPrice: packaging,
        cost: packaging,
        itemIndex: block.itemIndex,
      },
      {
        type: 'shipping',
        item: `${block.productName} — freight`,
        quantity: 1,
        unitPrice: shipping,
        cost: shipping,
        itemIndex: block.itemIndex,
      },
    ]
  })
}
