import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/database'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { data: notifications, isLoading, markRead, markAllRead } = useNotifications()

  if (isLoading) {
    return <div className="text-muted-foreground">Loading notifications...</div>
  }

  const handleSelect = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications</h2>
        <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          Mark all read
        </Button>
      </div>

      <div className="space-y-3">
        {notifications?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">No notifications yet.</CardContent>
          </Card>
        )}
        {notifications?.map((n) => (
          <Card
            key={n.id}
            onClick={() => handleSelect(n)}
            className={cn(
              'cursor-pointer transition-colors hover:bg-accent',
              n.read && 'opacity-60'
            )}
          >
            <CardContent className="flex items-start gap-3 py-4">
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  n.read ? 'bg-transparent' : 'bg-[var(--hub)]'
                )}
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{n.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
              </div>
              {n.link && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
