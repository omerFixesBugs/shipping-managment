import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  approveProcurementRequest,
  fetchProductPricingMap,
  rejectProcurementRequest,
  upsertSingleProductPricing,
} from '@/lib/procurementApproval'
import { buildProductCostsFromQuote, type QuoteBreakdownLine } from '@/lib/quotePricing'
import type { ProductPricingInput } from '@/lib/productPricing'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { ProcurementProductRow } from '@/components/ProcurementStatusBoard'

type Props = {
  row: ProcurementProductRow
  onDone?: () => void
  /** Inline = sits beside quote in wide dialog; hides duplicate hub cost block. */
  layout?: 'stacked' | 'inline'
}

export function ProcurementQuickApprovePanel({ row, onDone, layout = 'stacked' }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { request, item, itemIndex } = row
  const quote = request.quotes?.[0]

  const [clientPrice, setClientPrice] = useState('')
  const [advanceAmount, setAdvanceAmount] = useState('')

  const { data: savedPricing } = useQuery({
    queryKey: ['product-pricing', request.id],
    queryFn: () => fetchProductPricingMap(request.id),
    enabled: request.status === 'quoted' && !!quote,
  })

  useEffect(() => {
    const saved = savedPricing?.get(itemIndex)
    if (saved) {
      setClientPrice(saved.clientPrice > 0 ? String(saved.clientPrice) : '')
      setAdvanceAmount(saved.advanceAmount > 0 ? String(saved.advanceAmount) : '')
    }
  }, [savedPricing, itemIndex])

  const costs = useMemo(() => {
    if (!quote) return null
    return buildProductCostsFromQuote(request.items, (quote.breakdown ?? []) as QuoteBreakdownLine[])[itemIndex]
  }, [quote, request.items, itemIndex])

  const margin =
    costs && Number(clientPrice) > 0 ? Number(clientPrice) - costs.totalCost : null

  const buildAllPricingInputs = async (): Promise<ProductPricingInput[]> => {
    const breakdown = (quote?.breakdown ?? []) as QuoteBreakdownLine[]
    const costRows = buildProductCostsFromQuote(request.items, breakdown)
    const saved = savedPricing ?? (await fetchProductPricingMap(request.id))

    return request.items.map((it, i) => {
      const fromForm =
        i === itemIndex
          ? { clientPrice: Number(clientPrice) || 0, advanceAmount: Number(advanceAmount) || 0 }
          : saved.get(i)
      return {
        itemIndex: i,
        productName: it.name,
        purchaseCost: costRows[i]?.totalCost ?? null,
        clientPrice: fromForm?.clientPrice ?? 0,
        advanceAmount: fromForm?.advanceAmount ?? 0,
        currency: quote?.currency ?? 'USD',
      }
    })
  }

  const savePrice = useMutation({
    mutationFn: async () => {
      if (!quote) throw new Error('No quote found')
      const price = Number(clientPrice)
      if (!price || price <= 0) throw new Error('Enter a client price')
      await upsertSingleProductPricing(request.id, request.client_id, item, itemIndex, {
        purchaseCost: costs?.totalCost ?? null,
        clientPrice: price,
        advanceAmount: Number(advanceAmount) || 0,
        currency: quote.currency,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-pricing', request.id] })
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      onDone?.()
    },
  })

  const approve = useMutation({
    mutationFn: async () => {
      if (!quote || !user) throw new Error('Missing quote or user')
      const inputs = await buildAllPricingInputs()
      await approveProcurementRequest({
        requestId: request.id,
        userId: user.id,
        request,
        quoteId: quote.id,
        pricingInputs: inputs,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-pricing', request.id] })
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      queryClient.invalidateQueries({ queryKey: ['procurement-request', request.id] })
      onDone?.()
    },
  })

  const reject = useMutation({
    mutationFn: async () => {
      await rejectProcurementRequest(request.id, quote?.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
      queryClient.invalidateQueries({ queryKey: ['procurement-request', request.id] })
      onDone?.()
    },
  })

  if (request.status !== 'quoted' || !quote) return null

  const pricedCount =
    request.items.filter((_, i) => {
      if (i === itemIndex) return Number(clientPrice) > 0
      return (savedPricing?.get(i)?.clientPrice ?? 0) > 0
    }).length

  const inline = layout === 'inline'

  return (
    <div className="space-y-2.5 rounded-lg border border-dashed border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          Your pricing
        </p>
        <p className="text-[11px] text-muted-foreground">
          {pricedCount}/{request.items.length} priced
          {margin != null && (
            <span className={margin >= 0 ? ' text-emerald-600' : ' text-red-600'}>
              {' · '}Margin {formatCurrency(margin, quote.currency)}
            </span>
          )}
        </p>
      </div>

      {!inline && costs && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Hub total cost</dt>
          <dd className="text-right font-data font-semibold">
            {formatCurrency(costs.totalCost, quote.currency)}
          </dd>
        </dl>
      )}

      <div className={inline ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-3'}>
        <div className="space-y-1">
          <Label className="text-[11px]">Client price ({quote.currency})</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-9"
            value={clientPrice}
            onChange={(e) => setClientPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Advance</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-9"
            value={advanceAmount}
            onChange={(e) => setAdvanceAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={savePrice.isPending}
          onClick={() => savePrice.mutate()}
        >
          {savePrice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save price'}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={approve.isPending || pricedCount < request.items.length}
          onClick={() => approve.mutate()}
        >
          {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={reject.isPending}
          onClick={() => reject.mutate()}
        >
          Reject
        </Button>
      </div>

      {(savePrice.isError || approve.isError) && (
        <p className="text-xs text-red-500">
          {((savePrice.error ?? approve.error) as Error).message}
        </p>
      )}
    </div>
  )
}
