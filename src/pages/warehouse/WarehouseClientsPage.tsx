import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import type { Client } from '@/types/database'

export function WarehouseClientsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      return data as Client[]
    },
  })

  const createClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('clients').insert({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setOpen(false)
      setForm({ name: '', phone: '', email: '', address: '' })
      setFormError(null)
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Failed to create client')
    },
  })

  // Any warehouse manager can register clients
  const canAdd = profile?.role === 'warehouse_manager'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clients</h2>
        {canAdd && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add Client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Client</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); setFormError(null); createClient.mutate() }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                    placeholder="+88017…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? 'Saving…' : 'Save Client'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Phone</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Address</th>
                </tr>
              </thead>
              <tbody>
                {clients?.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3">{c.phone}</td>
                    <td className="py-3">{c.email ?? '—'}</td>
                    <td className="py-3">{c.address ?? '—'}</td>
                  </tr>
                ))}
                {!clients?.length && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No clients yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
