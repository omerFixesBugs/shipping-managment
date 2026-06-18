import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Client } from '@/types/database'

type AddClientDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (client: Client) => void
}

const emptyForm = { name: '', phone: '', email: '', address: '' }

export function AddClientDialog({ open, onOpenChange, onCreated }: AddClientDialogProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)

  const createClient = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          address: form.address.trim() || null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Client
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setForm(emptyForm)
      onOpenChange(false)
      onCreated?.(client)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setForm(emptyForm)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createClient.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Client or business name"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Phone (E.164)</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+88017..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Address <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          {createClient.isError && (
            <p className="text-sm text-red-500">
              {(createClient.error as Error).message || 'Could not create client'}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={createClient.isPending}>
            {createClient.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
            ) : (
              'Save client'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
