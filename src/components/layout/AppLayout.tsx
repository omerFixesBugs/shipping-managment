import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  DollarSign,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Plus,
  Ship,
  ShoppingCart,
  Sun,
  Truck,
  Users,
  UserCog,
  Globe,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { cn } from '@/lib/utils'
import { getWorkspaceTheme } from '@/lib/constants'
import type { CSSProperties } from 'react'
import type { HubType, UserRole } from '@/types/database'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  /** When set, only show for warehouse managers whose hub is included. */
  hubs?: HubType[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Operations Overview', href: '/owner', icon: LayoutDashboard, roles: ['owner'] },
  { label: 'Procurement', href: '/owner/procurement', icon: ShoppingCart, roles: ['owner'] },
  { label: 'Logistics Tracking', href: '/owner/shipments', icon: Truck, roles: ['owner'] },
  { label: 'Warehouse Hubs', href: '/owner/hubs', icon: Globe, roles: ['owner'] },
  { label: 'Clients', href: '/owner/clients', icon: Users, roles: ['owner'] },
  { label: 'Financial Reports', href: '/owner/finance', icon: DollarSign, roles: ['owner'] },
  { label: 'Employees', href: '/owner/employees', icon: UserCog, roles: ['owner'] },
  { label: 'Hub Dashboard', href: '/warehouse', icon: Box, roles: ['warehouse_manager'] },
  { label: 'Procurement', href: '/warehouse/procurement', icon: ShoppingCart, roles: ['warehouse_manager'] },
  { label: 'Storage', href: '/warehouse/storage', icon: Warehouse, roles: ['warehouse_manager'], hubs: ['dubai', 'china', 'bangladesh'] },
  { label: 'Shipments', href: '/warehouse/shipments', icon: Package, roles: ['warehouse_manager'] },
  { label: 'Collections', href: '/warehouse/collections', icon: HandCoins, roles: ['warehouse_manager'], hubs: ['bangladesh'] },
  { label: 'Clients', href: '/warehouse/clients', icon: Users, roles: ['warehouse_manager'] },
  { label: 'My Shipments', href: '/client', icon: Package, roles: ['client'] },
]

interface SidebarCta {
  label: string
  href: string
}

const SIDEBAR_CTA: Partial<Record<UserRole, SidebarCta>> = {
  owner: { label: 'New Request', href: '/owner/procurement/new' },
  warehouse_manager: { label: 'New Shipment', href: '/warehouse/shipments' },
}

function initials(name: string | undefined) {
  if (!name) return '·'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const visibleNav = NAV_ITEMS.filter(
    (item) =>
      profile &&
      item.roles.includes(profile.role) &&
      (!item.hubs || (profile.hub != null && item.hubs.includes(profile.hub)))
  )
  const workspace = getWorkspaceTheme(profile?.role, profile?.hub)
  const isBd = profile?.role === 'warehouse_manager' && profile?.hub === 'bangladesh'
  const cta = profile
    ? isBd
      ? { label: 'New Request', href: '/warehouse/procurement/new' }
      : SIDEBAR_CTA[profile.role]
    : undefined

  // Longest-prefix match so /owner/shipments doesn't activate /owner dashboard
  const activeItem = visibleNav.reduce<NavItem | undefined>((best, item) => {
    const matches =
      location.pathname === item.href || location.pathname.startsWith(item.href + '/')
    if (!matches) return best
    if (!best || item.href.length > best.href.length) return item
    return best
  }, undefined)

  const hubStyle = {
    '--hub': workspace.accent,
    '--hub-foreground': workspace.accentForeground,
    '--hub-soft': workspace.accentSoft,
  } as CSSProperties

  return (
    <div className="flex min-h-screen bg-background text-foreground" style={hubStyle}>
      <aside className="flex w-64 flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)]">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white"
            style={{ backgroundColor: 'var(--hub)' }}
          >
            <Ship className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">Logistics OS</p>
            <p className="text-[11px] text-[var(--color-sidebar-muted)]">{workspace.label}</p>
          </div>
        </div>

        {/* Primary CTA */}
        {cta ? (
          <div className="px-3 pb-2">
            {profile?.role === 'warehouse_manager' ? (
              <button
                type="button"
                onClick={() => navigate(cta.href, { state: { openCreate: true } })}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                {cta.label}
              </button>
            ) : (
              <Link
                to={cta.href}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                {cta.label}
              </Link>
            )}
          </div>
        ) : null}

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-3">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const active = item === activeItem
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/5 text-white'
                    : 'text-[var(--color-sidebar-foreground)] hover:bg-white/5 hover:text-white'
                )}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full"
                    style={{ backgroundColor: 'var(--hub)' }}
                  />
                ) : null}
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer: user + sign out */}
        <div className="border-t border-[var(--color-sidebar-border)] p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--hub)' }}
            >
              {initials(profile?.full_name)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name}</p>
              <p className="truncate text-[11px] capitalize text-[var(--color-sidebar-muted)]">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-sidebar-foreground)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {activeItem?.label ?? 'Logistics OS'}
            </h2>
            <span
              className="hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex"
              style={{ backgroundColor: 'var(--hub-soft)', color: 'var(--hub)' }}
            >
              {workspace.label}
            </span>
          </div>
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
            <span
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--hub)' }}
              title={profile?.full_name}
            >
              {initials(profile?.full_name)}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
