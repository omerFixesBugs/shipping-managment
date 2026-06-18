import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProcurementProductSummaryDialog } from '@/components/ProcurementProductSummaryDialog'
import {
  OWNER_STATUS_SECTIONS,
  ProcurementStatusBoard,
  type ProcurementProductRow,
} from '@/components/ProcurementStatusBoard'
import type { ProcurementRequest } from '@/types/database'

export function ProcurementPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState<ProcurementProductRow | null>(null)

  const { data: requests, isLoading } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_requests')
        .select('*, quotes(*), clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ProcurementRequest[]
    },
  })

  const productRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (requests ?? [])
      .filter((r) => {
        if (!q) return true
        return (
          r.title.toLowerCase().includes(q) ||
          r.clients?.name?.toLowerCase().includes(q) ||
          r.items?.some((i) => i.name.toLowerCase().includes(q))
        )
      })
      .flatMap((request) =>
        (request.items ?? []).map((item, itemIndex) => ({ request, item, itemIndex }))
      ) as ProcurementProductRow[]
  }, [requests, search])

  const activeColumns = useMemo(
    () => OWNER_STATUS_SECTIONS.filter((s) => productRows.some((r) => r.request.status === s.status)).length,
    [productRows]
  )

  const deleteProduct = async () => {
    if (!selectedRow) return
    const { request, itemIndex } = selectedRow
    const newItems = (request.items ?? []).filter((_, i) => i !== itemIndex)
    if (newItems.length === 0) {
      const { error } = await supabase.from('procurement_requests').delete().eq('id', request.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('procurement_requests')
        .update({ items: newItems })
        .eq('id', request.id)
      if (error) throw error
    }
    await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] })
    setSelectedRow(null)
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Sourcing Requests</h2>
          <p className="text-xs text-muted-foreground">
            Pipeline view — products grouped by procurement status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-[220px] sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, clients, requests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button asChild>
            <Link to="/owner/procurement/new">
              <ShoppingCart className="h-4 w-4" /> New Request
            </Link>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ProcurementStatusBoard
          sections={OWNER_STATUS_SECTIONS}
          rows={productRows}
          isLoading={isLoading}
          onProductClick={setSelectedRow}
          onSectionClick={(section) => navigate(`/owner/procurement/status/${section.status}`)}
          showHub
          hideEmptyColumns={search.trim().length > 0}
          emptyMessage={
            search.trim()
              ? 'No products match your search.'
              : 'No procurement products yet. Create a request to get started.'
          }
        />
      </div>

      {!isLoading && productRows.length > 0 && (
        <p className="shrink-0 text-xs text-muted-foreground">
          {productRows.length} product{productRows.length !== 1 ? 's' : ''}
          {search.trim() ? ' matching search' : ''} · {activeColumns} active column
          {activeColumns !== 1 ? 's' : ''}
        </p>
      )}

      <ProcurementProductSummaryDialog
        row={selectedRow}
        open={!!selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        manageHref={
          selectedRow
            ? `/owner/procurement/${selectedRow.request.id}?item=${selectedRow.itemIndex}`
            : '#'
        }
        showHub
        showQuickApprove
        canDelete
        onDelete={deleteProduct}
      />
    </div>
  )
}
