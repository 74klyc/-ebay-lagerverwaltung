import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  TrendingUp,
  FileText,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Lager', icon: Package, path: '/inventory', hasChildren: true },
  { label: 'Listings', icon: Tag, path: '/listings', hasChildren: true },
  { label: 'Verkäufe', icon: ShoppingCart, path: '/sales' },
  { label: 'Finanzen', icon: TrendingUp, path: '/finances', hasChildren: true },
  { label: 'Steuern', icon: FileText, path: '/taxes', hasChildren: true },
  { divider: true },
  { label: 'Einstellungen', icon: Settings, path: '/settings' },
]

const subNavItems: Record<string, { label: string; path: string }[]> = {
  '/inventory': [
    { label: 'Alle Artikel', path: '/inventory' },
    { label: 'Kategorien', path: '/inventory/categories' },
    { label: 'Lagerorte', path: '/inventory/locations' },
  ],
  '/listings': [
    { label: 'Alle Listings', path: '/listings' },
    { label: 'Entwürfe', path: '/listings?status=draft' },
    { label: 'Aktiv', path: '/listings?status=active' },
  ],
  '/finances': [
    { label: 'Übersicht', path: '/finances' },
    { label: 'Gewinn & Verlust', path: '/finances/profit-loss' },
    { label: 'Ausgaben', path: '/finances/expenses' },
  ],
  '/taxes': [
    { label: 'Übersicht', path: '/taxes' },
    { label: 'EÜR', path: '/taxes/euer' },
    { label: 'Umsatzsteuer', path: '/taxes/vat' },
  ],
}

export function Sidebar() {
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<string[]>(['/inventory'])

  const toggleExpand = (path: string) => {
    setExpandedItems((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Package className="h-6 w-6 text-primary" />
          <span>eBay Lager</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item, index) => {
          if (item.divider) {
            return <div key={index} className="h-px bg-border my-4" />
          }

          const Icon = item.icon!
          const active = isActive(item.path!)
          const expanded = expandedItems.includes(item.path!)

          return (
            <div key={item.path}>
              <button
                onClick={() => (item.hasChildren ? toggleExpand(item.path!) : undefined)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Link to={item.path!} className="flex items-center gap-3 flex-1">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
                {item.hasChildren && (
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      expanded && 'rotate-180'
                    )}
                  />
                )}
              </button>
              {item.hasChildren && expanded && subNavItems[item.path!] && (
                <div className="ml-7 mt-1 space-y-1">
                  {subNavItems[item.path!].map((subItem) => (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      className={cn(
                        'block rounded-lg px-3 py-1.5 text-sm transition-colors',
                        location.pathname === subItem.path ||
                          (subItem.path.includes('?') &&
                            location.pathname + location.search === subItem.path)
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {subItem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
