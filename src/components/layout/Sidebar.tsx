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
import { useAuth } from '@/features/auth/hooks/useAuth'

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

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<string[]>(['/inventory'])
  const { session } = useAuth()

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
    <aside className={cn("flex w-64 border-r border-black brushed-metal flex-col z-20 h-full", className)}>
      <div className="p-8 flex items-center gap-3">
        <div className="h-8 w-8 hex-accent flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <span className="text-black font-black text-xs">EB</span>
        </div>
        <h1 className="font-extrabold tracking-tighter text-xl italic text-white">LAGER<span className="text-blue-500">SYS</span></h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4 px-4 font-bold">Hauptmenü</div>
        {navItems.map((item, index) => {
          if (item.divider) {
            return <div key={index} className="h-px bg-white/10 my-4" />
          }

          const Icon = item.icon!
          const active = isActive(item.path!)
          const expanded = expandedItems.includes(item.path!)

          return (
            <div key={item.path}>
              <button
                onClick={() => {
                  if (item.hasChildren) toggleExpand(item.path!)
                  else if (!active) document.location.href = item.path! // Simulating click for parent link if no children conceptually but typically we'd just want to navigate. If it has no children, we wrap it in a Link or navigate. It's safe to use a manual router navigation here but we can also wrap in link. Actually the previous code had `<Link>` inside `<button>`. Let's structure it like the previous code.
                }}
                className={cn(
                  'nav-item flex w-full items-center justify-between gap-4 px-4 py-3 text-sm font-medium transition-all group border-r-2 bg-transparent',
                  active
                    ? 'border-blue-500 bg-white/5 text-white'
                    : 'border-transparent text-zinc-400 hover:text-white'
                )}
              >
                <Link to={item.path!} className="flex items-center gap-4 flex-1" onClick={(e) => item.hasChildren && e.preventDefault()}>
                  <Icon className={cn("w-5 h-5", active ? "text-blue-500" : "")} />
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
                <div className="ml-9 mt-1 space-y-1">
                  {subNavItems[item.path!].map((subItem) => {
                    const subActive = location.pathname === subItem.path ||
                        (subItem.path.includes('?') &&
                          location.pathname + location.search === subItem.path);
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        className={cn(
                          'block rounded-lg px-4 py-2 text-xs transition-colors',
                          subActive
                            ? 'text-blue-400 font-bold bg-white/5'
                            : 'text-zinc-500 hover:text-zinc-300'
                        )}
                      >
                        - {subItem.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
