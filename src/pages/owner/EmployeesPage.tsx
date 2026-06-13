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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { HUB_LABELS } from '@/lib/constants'
import { UserPlus, KeyRound, Pencil } from 'lucide-react'
import type { HubType, Profile } from '@/types/database'

const ALL_HUBS: HubType[] = ['dubai', 'china', 'bangladesh']

export function EmployeesPage() {
  const queryClient = useQueryClient()

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'warehouse_manager')
        .order('hub')
        .order('full_name')
      if (error) throw error
      return data as Profile[]
    },
  })

  const byHub = ALL_HUBS.map((hub) => ({
    hub,
    members: employees?.filter((e) => e.hub === hub) ?? [],
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Employees</h2>
        <NewEmployeeDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['employees'] })} />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {byHub.map(({ hub, members }) => (
        <Card key={hub}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--hub)' }} />
              <CardTitle>{HUB_LABELS[hub]} Hub</CardTitle>
              <span className="text-sm text-muted-foreground">({members.length} staff)</span>
            </div>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees assigned to this hub yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Position</th>
                    <th className="pb-3 font-medium">Phone</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((emp) => (
                    <tr key={emp.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{emp.full_name}</td>
                      <td className="py-3 text-muted-foreground">{emp.position ?? '—'}</td>
                      <td className="py-3 text-muted-foreground">{emp.phone ?? '—'}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <EditEmployeeDialog
                            employee={emp}
                            onSaved={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
                          />
                          <SetPasswordDialog employeeId={emp.id} employeeName={emp.full_name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function NewEmployeeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', hub: 'dubai' as HubType, position: '',
  })
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: {
          type: 'create_employee',
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: 'warehouse_manager',
          hub: form.hub,
          position: form.position || undefined,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      onCreated()
      setOpen(false)
      setForm({ email: '', password: '', full_name: '', hub: 'dubai', position: '' })
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create employee'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" />Add Employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Warehouse Employee</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate() }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Full Name <span className="text-red-500">*</span></Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Email <span className="text-red-500">*</span></Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hub <span className="text-red-500">*</span></Label>
              <Select value={form.hub} onValueChange={(v) => setForm({ ...form, hub: v as HubType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_HUBS.map((h) => <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g. Warehouse Incharge" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Initial Password <span className="text-red-500">*</span></Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required minLength={6}
              placeholder="Min 6 characters"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={create.isPending} className="w-full">
            {create.isPending ? 'Creating…' : 'Create Employee Account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditEmployeeDialog({ employee, onSaved }: { employee: Profile; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    full_name: employee.full_name,
    position: employee.position ?? '',
    hub: employee.hub ?? 'dubai',
    phone: employee.phone ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: {
          type: 'update_profile',
          userId: employee.id,
          full_name: form.full_name,
          position: form.position || null,
          hub: form.hub,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      // Also update phone directly since it's not sensitive
      await supabase.from('profiles').update({ phone: form.phone || null }).eq('id', employee.id)
    },
    onSuccess: () => {
      onSaved()
      setOpen(false)
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to update'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate() }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hub</Label>
              <Select value={form.hub as string} onValueChange={(v) => setForm({ ...form, hub: v as HubType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_HUBS.map((h) => <SelectItem key={h} value={h}>{HUB_LABELS[h]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g. Supervisor" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+88017…" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={save.isPending} className="w-full">
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SetPasswordDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const setPass = useMutation({
    mutationFn: async () => {
      if (password !== confirm) throw new Error('Passwords do not match')
      if (password.length < 6) throw new Error('Password must be at least 6 characters')

      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { type: 'set_password', userId: employeeId, password },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      setSuccess(true)
      setPassword('')
      setConfirm('')
      setTimeout(() => { setOpen(false); setSuccess(false) }, 1500)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to set password'),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setSuccess(false) }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Set password">
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Password — {employeeName}</DialogTitle>
        </DialogHeader>
        {success ? (
          <p className="py-4 text-center text-sm font-medium text-emerald-600">Password updated successfully.</p>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); setError(null); setPass.mutate() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6} required placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required placeholder="Repeat password"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" disabled={setPass.isPending} className="w-full">
              {setPass.isPending ? 'Updating…' : 'Update Password'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
