import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Box,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  ShoppingCart,
  Sun,
  Truck,
  Users,
  UserCog,
  Globe,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { cn } from '@/lib/utils'
import { getWorkspaceTheme } from '@/lib/constants'
import type { CSSProperties } from 'react'
import type { UserRole } from '@/types/database'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/owner', icon: LayoutDashboard, roles: ['owner'] },
  { label: 'Procurement', href: '/owner/procurement', icon: ShoppingCart, roles: ['owner'] },
  { label: 'Shipments', href: '/owner/shipments', icon: Truck, roles: ['owner'] },
  { label: 'Hub Overview', href: '/owner/hubs', icon: Globe, roles: ['owner'] },
  { label: 'Clients', href: '/owner/clients', icon: Users, roles: ['owner'] },
  { label: 'Finance', href: '/owner/finance', icon: DollarSign, roles: ['owner'] },
  { label: 'Employees', href: '/owner/employees', icon: UserCog, roles: ['owner'] },
  { label: 'Hub Dashboard', href: '/warehouse', icon: Box, roles: ['warehouse_manager'] },
  { label: 'Procurement', href: '/warehouse/procurement', icon: ShoppingCart, roles: ['warehouse_manager'] },
  { label: 'Shipments', href: '/warehouse/shipments', icon: Package, roles: ['warehouse_manager'] },
  { label: 'Clients', href: '/warehouse/clients', icon: Users, roles: ['warehouse_manager'] },
  { label: 'My Shipments', href: '/client', icon: Package, roles: ['client'] },
]

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const visibleNav = NAV_ITEMS.filter((item) => profile && item.roles.includes(profile.role))
  const workspace = getWorkspaceTheme(profile?.role, profile?.hub)

  const hubStyle = {
    '--hub': workspace.accent,
    '--hub-foreground': workspace.accentForeground,
    '--hub-soft': workspace.accentSoft,
  } as CSSProperties

  return (
    <div className="flex min-h-screen bg-background text-foreground" style={hubStyle}>
      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="border-b p-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[var(--hub)]" />
            <h1 className="text-lg font-bold">LogiFlow</h1>
          </div>
          <p
            className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: 'var(--hub-soft)', color: 'var(--hub)' }}
          >
            {workspace.label}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{profile?.full_name}</p>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const active =
              location.pathname === item.href || location.pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                to={item.href}
                style={active ? { backgroundColor: 'var(--hub)', color: 'var(--hub-foreground)' } : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  !active && 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <Button variant="ghost" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header
          className="flex h-14 items-center justify-between border-b bg-card px-6"
          style={{ borderTopColor: 'var(--hub)', borderTopWidth: 3 }}
        >
          <div />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
