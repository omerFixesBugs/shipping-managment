import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateField } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FINANCIAL_CATEGORY_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { FinancialCategory, ProductPnl, Shipment, ShipmentPnl } from '@/types/database'

export function FinancePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [hubFilter, setHubFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    shipment_id: '',
    category: 'purchase_cost' as FinancialCategory,
    amount: '',
    currency: 'USD',
    description: '',
    entry_date: new Date().toISOString().split('T')[0],
  })

  const { data: pnl, isLoading } = useQuery({
    queryKey: ['shipment-pnl', hubFilter],
    queryFn: async () => {
      let query = supabase.from('shipment_pnl').select('*')
      if (hubFilter !== 'all') {
        query = query.eq('origin_hub', hubFilter)
      }
      const { data, error } = await query
      if (error) throw error
      return data as ShipmentPnl[]
    },
  })

  const { data: shipments } = useQuery({
    queryKey: ['shipments-for-finance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('id, reference_code')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Pick<Shipment, 'id' | 'reference_code'>[]
    },
  })

  const { data: productPnl, isLoading: productLoading } = useQuery({
    queryKey: ['product-pnl'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_pnl').select('*').order('request_title')
      if (error) throw error
      return data as ProductPnl[]
    },
  })

  const productTotals = productPnl?.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.client_price),
      costs: acc.costs + Number(row.purchase_cost ?? 0),
      profit: acc.profit + Number(row.margin ?? 0),
      collected: acc.collected + Number(row.collected),
      outstanding: acc.outstanding + Number(row.outstanding),
    }),
    { revenue: 0, costs: 0, profit: 0, collected: 0, outstanding: 0 }
  ) ?? { revenue: 0, costs: 0, profit: 0, collected: 0, outstanding: 0 }

  const addEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('financial_entries').insert({
        shipment_id: form.shipment_id || null,
        category: form.category,
        amount: Number(form.amount),
        currency: form.currency,
        description: form.description || null,
        entry_date: form.entry_date,
        created_by: user!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-pnl'] })
      setShowForm(false)
      setForm({ ...form, amount: '', description: '' })
    },
  })

  const totals = pnl?.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue),
      costs: acc.costs + Number(row.costs),
      profit: acc.profit + Number(row.profit),
    }),
    { revenue: 0, costs: 0, profit: 0 }
  ) ?? { revenue: 0, costs: 0, profit: 0 }

  const exportCsv = () => {
    if (!pnl?.length) return
    const headers = ['Reference', 'Type', 'Origin', 'Status', 'Revenue', 'Costs', 'Profit']
    const rows = pnl.map((r) => [
      r.reference_code, r.type, r.origin_hub, r.status, r.revenue, r.costs, r.profit,
    ])
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pnl-report.csv'
    a.click()
  }

  const margin = totals.revenue ? Math.round((totals.profit / totals.revenue) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reporting"
        description="Profit/Loss and cost analysis across global hubs."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button onClick={() => setShowForm(!showForm)}>Add Entry</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Product Revenue (Listed)"
          value={formatCurrency(productTotals.revenue)}
          mono
          hint={`Collected ${formatCurrency(productTotals.collected)}`}
        />
        <StatCard
          label="Product Cost"
          value={formatCurrency(productTotals.costs)}
          mono
          hint="Owner buy price"
        />
        <StatCard
          label="Product Margin"
          value={formatCurrency(productTotals.profit)}
          mono
          hint={`Outstanding ${formatCurrency(productTotals.outstanding)}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totals.revenue)}
          mono
          trend={{ value: 'gross income', direction: 'up' }}
        />
        <StatCard
          label="Total Costs"
          value={formatCurrency(totals.costs)}
          mono
          trend={{ value: 'purchase + freight + duty', direction: 'down' }}
        />
        <StatCard
          label="Net Profit"
          value={formatCurrency(totals.profit)}
          mono
          hint={`Margin ${margin}%`}
        />
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Financial Entry</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Shipment</Label>
              <Select value={form.shipment_id} onValueChange={(v) => setForm({ ...form, shipment_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select shipment" /></SelectTrigger>
                <SelectContent>
                  {shipments?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.reference_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as FinancialCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FINANCIAL_CATEGORY_LABELS) as FinancialCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{FINANCIAL_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <DateField
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                showClear={false}
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={() => addEntry.mutate()} disabled={!form.shipment_id || !form.amount}>
                Save Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Product P&L</CardTitle>
        </CardHeader>
        <CardContent>
          {productLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : !productPnl?.length ? (
            <p className="text-sm text-muted-foreground">No product pricing data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Product</th>
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Mode</th>
                    <th className="pb-3 font-medium text-right">Buy</th>
                    <th className="pb-3 font-medium text-right">Sell</th>
                    <th className="pb-3 font-medium text-right">Margin</th>
                    <th className="pb-3 font-medium text-right">Advance</th>
                    <th className="pb-3 font-medium text-right">Collected</th>
                    <th className="pb-3 font-medium text-right">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {productPnl.map((row) => (
                    <tr key={row.pricing_id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{row.product_name}</td>
                      <td className="py-3">{row.client_name ?? '—'}</td>
                      <td className="py-3 capitalize">{row.request_mode.replace('_', ' ')}</td>
                      <td className="py-3 text-right text-red-600">
                        {row.purchase_cost != null ? formatCurrency(Number(row.purchase_cost), row.currency) : '—'}
                      </td>
                      <td className="py-3 text-right">{formatCurrency(Number(row.client_price), row.currency)}</td>
                      <td className="py-3 text-right font-semibold text-emerald-600">
                        {formatCurrency(Number(row.margin), row.currency)}
                      </td>
                      <td className="py-3 text-right">{formatCurrency(Number(row.advance_amount), row.currency)}</td>
                      <td className="py-3 text-right">{formatCurrency(Number(row.collected), row.currency)}</td>
                      <td className="py-3 text-right text-amber-600">{formatCurrency(Number(row.outstanding), row.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shipment P&L</CardTitle>
          <Select value={hubFilter} onValueChange={setHubFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hubs</SelectItem>
              <SelectItem value="dubai">Dubai</SelectItem>
              <SelectItem value="china">China</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Origin</th>
                  <th className="pb-3 font-medium">Revenue</th>
                  <th className="pb-3 font-medium">Costs</th>
                  <th className="pb-3 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {pnl?.map((row) => (
                  <tr key={row.shipment_id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{row.reference_code}</td>
                    <td className="py-3 capitalize">{row.type.replace('_', ' ')}</td>
                    <td className="py-3 capitalize">{row.origin_hub}</td>
                    <td className="py-3 text-emerald-600">{formatCurrency(Number(row.revenue))}</td>
                    <td className="py-3 text-red-600">{formatCurrency(Number(row.costs))}</td>
                    <td className="py-3 font-medium">{formatCurrency(Number(row.profit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
