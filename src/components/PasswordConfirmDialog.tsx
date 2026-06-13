import { useState, type ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Wraps an important/destructive action behind a password re-check.
 * Verifies the current user's password before firing onConfirmed.
 */
export function PasswordConfirmDialog({
  trigger,
  title,
  description,
  actionLabel = 'Confirm',
  destructive = false,
  onConfirmed,
}: {
  trigger: ReactNode
  title: string
  description?: string
  actionLabel?: string
  destructive?: boolean
  onConfirmed: () => Promise<void> | void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (!user?.email) throw new Error('No active session')
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      })
      if (authError) throw new Error('Incorrect password')
      await onConfirmed()
      setOpen(false)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setPassword('') }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className={destructive ? 'h-5 w-5 text-red-500' : 'h-5 w-5 text-amber-500'} />
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <div className="space-y-2">
            <Label>Enter your password to confirm</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="submit"
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy || !password}
            className="w-full"
          >
            {busy ? 'Verifying…' : actionLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
