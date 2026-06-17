import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { calcSettlementAmounts, maybeCompleteShipment } from '@/lib/bdItemFulfillment'
import type { BdProductPricing, ShipmentItem } from '@/types/database'

type ExtraCost = { label: string; amount: string }

type ClientSettlementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pricing: BdProductPricing | null
  shipmentItem?: ShipmentItem | null
  shipmentItemId?: string
  clientName?: string
  onSaved: () => void
}

export function ClientSettlementDialog({
  open,
  onOpenChange,
  pricing,
  shipmentItem,
  shipmentItemId,
  clientName,
  onSaved,
}: ClientSettlementDialogProps) {
  const { user } = useAuth()
  const itemId = shipmentItem?.id ?? shipmentItemId
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>(
    shipmentItem?.delivery_type ?? 'pickup'
  )
  const [hasAdvance, setHasAdvance] = useState(false)
  const [advanceApplied, setAdvanceApplied] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [dueAmount, setDueAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([])
  const [error, setError] = useState<string | null>(null)

  const clientPrice = pricing?.client_price ?? 0
  const maxAdvance = pricing?.advance_amount ?? 0
  const currency = pricing?.currency ?? 'USD'

  useEffect(() => {
    if (!open) return
    setDeliveryType(shipmentItem?.delivery_type ?? 'pickup')
    setHasAdvance(maxAdvance > 0)
    setAdvanceApplied(maxAdvance > 0 ? String(maxAdvance) : '')
    setNotes('')
    setExtraCosts([])
    setError(null)
    const { totalDue } = calcSettlementAmounts({
      clientPrice,
      advanceAmount: maxAdvance,
      applyAdvance: maxAdvance > 0,
      extraCosts: [],
      amountPaid: 0,
    })
    setAmountPaid(totalDue > 0 ? String(totalDue) : '')
    setDueAmount('0')
  }, [open, shipmentItem?.delivery_type, maxAdvance, clientPrice])

  useEffect(() => {
    const { balance } = calcSettlementAmounts({
      clientPrice,
      advanceAmount: maxAdvance,
      applyAdvance: hasAdvance,
      extraCosts: extraCosts.map((e) => ({ amount: Number(e.amount) || 0 })),
      amountPaid: Number(amountPaid) || 0,
    })
    setDueAmount(String(balance))
  }, [clientPrice, maxAdvance, hasAdvance, extraCosts, amountPaid])

  const save = useMutation({
    mutationFn: async () => {
      const clientId = pricing?.client_id ?? shipmentItem?.client_id
      if (!clientId) throw new Error('No client linked to this product')

      const paid = Number(amountPaid) || 0
      const advance = hasAdvance ? Number(advanceApplied) || 0 : 0
      const extras = extraCosts
        .filter((e) => e.label && e.amount)
        .map((e) => ({ label: e.label, amount: Number(e.amount) }))
      const { balance } = calcSettlementAmounts({
        clientPrice,
        advanceAmount: maxAdvance,
        applyAdvance: hasAdvance,
        extraCosts: extras,
        amountPaid: paid,
      })

      const { data: settlement, error: insertError } = await supabase
        .from('client_settlements')
        .insert({
          client_id: clientId,
          product_pricing_id: pricing?.id || null,
          shipment_item_id: itemId || null,
          product_name: pricing?.product_name ?? shipmentItem?.name ?? 'Product',
          delivery_type: deliveryType,
          client_price: clientPrice,
          advance_applied: advance,
          amount_paid: paid,
          due_amount: balance,
          extra_costs: extras,
          notes: notes || null,
          recorded_by: user!.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      if (paid > 0 && pricing?.request_id) {
        await supabase.from('financial_entries').insert({
          shipment_id: shipmentItem?.shipment_id ?? null,
          procurement_request_id: pricing.request_id,
          product_pricing_id: pricing.id,
          category: 'product_revenue',
          amount: paid,
          currency,
          description: `Collection: ${pricing.product_name}`,
          entry_date: new Date().toISOString().split('T')[0],
          created_by: user!.id,
        })
      }

      if (itemId) {
        const now = new Date().toISOString()
        await supabase
          .from('shipment_items')
          .update({
            status: 'delivered',
            delivered_at: now,
            delivery_type: deliveryType,
            settlement_id: settlement.id,
            product_pricing_id: pricing?.id ?? shipmentItem?.product_pricing_id,
          })
          .eq('id', itemId)

        if (shipmentItem?.bd_inventory_id) {
          await supabase
            .from('warehouse_inventory')
            .update({ status: 'delivered' })
            .eq('id', shipmentItem.bd_inventory_id)
        }

        if (shipmentItem?.shipment_id) {
          await maybeCompleteShipment(shipmentItem.shipment_id)
        }
      }
    },
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to save'),
  })

  if (!pricing && !shipmentItem) return null

  const { totalDue, advance, extras: extrasTotal } = calcSettlementAmounts({
    clientPrice,
    advanceAmount: maxAdvance,
    applyAdvance: hasAdvance,
    extraCosts: extraCosts.map((e) => ({ amount: Number(e.amount) || 0 })),
    amountPaid: 0,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Client Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">{pricing?.product_name ?? shipmentItem?.name}</p>
            <p className="text-muted-foreground">
              {clientName ?? 'Client'}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Client price</dt>
              <dd className="font-data font-semibold">{clientPrice} {currency}</dd>
              {maxAdvance > 0 && (
                <>
                  <dt className="text-muted-foreground">Advance on file</dt>
                  <dd>{maxAdvance} {currency}</dd>
                </>
              )}
              {extrasTotal > 0 && (
                <>
                  <dt className="text-muted-foreground">Extra costs</dt>
                  <dd>+{extrasTotal.toFixed(2)} {currency}</dd>
                </>
              )}
              {hasAdvance && advance > 0 && (
                <>
                  <dt className="text-muted-foreground">Advance applied</dt>
                  <dd className="text-emerald-600">−{advance} {currency}</dd>
                </>
              )}
              <dt className="font-medium">Amount to collect</dt>
              <dd className="font-data font-bold text-[var(--hub)]">{totalDue.toFixed(2)} {currency}</dd>
            </dl>
          </div>

          <div className="space-y-2">
            <Label>Delivery Type</Label>
            <Select value={deliveryType} onValueChange={(v) => setDeliveryType(v as 'pickup' | 'delivery')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">Client Pickup</SelectItem>
                <SelectItem value="delivery">Delivered to Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {maxAdvance > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasAdvance}
                onChange={(e) => {
                  setHasAdvance(e.target.checked)
                  if (e.target.checked) setAdvanceApplied(String(maxAdvance))
                  else setAdvanceApplied('')
                }}
              />
              Apply advance payment ({maxAdvance} {currency})
            </label>
          )}

          {hasAdvance && (
            <div className="space-y-2">
              <Label>Advance Applied ({currency})</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={advanceApplied}
                onChange={(e) => setAdvanceApplied(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount Client Paid</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Balance Due</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={dueAmount}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Extra Costs (delivery, packaging…)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExtraCosts([...extraCosts, { label: '', amount: '' }])}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {extraCosts.map((ec, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Label"
                  value={ec.label}
                  onChange={(e) =>
                    setExtraCosts(extraCosts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="w-28"
                  value={ec.amount}
                  onChange={(e) =>
                    setExtraCosts(extraCosts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setExtraCosts(extraCosts.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            className="w-full"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Confirm Delivery & Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
