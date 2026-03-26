import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Search, LogOut, User, Menu } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'

interface TopBarProps {
  onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/inventory?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    toast({
      title: 'Abgemeldet',
      description: 'Sie wurden erfolgreich abgemeldet.',
    })
    navigate('/login')
  }

  return (
    <header className="h-20 border-b border-white/5 px-4 md:px-8 flex items-center justify-between sticky top-0 bg-[#0a0a0b]/80 backdrop-blur-xl z-10 shrink-0 w-full">
      <div className="flex items-center gap-4">
        <button
          className="lg:hidden text-zinc-400 hover:text-white transition-colors"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="hidden md:block text-sm font-bold text-zinc-500 uppercase tracking-[0.3em]">Systemübersicht</h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
        <form onSubmit={handleSearch} className="hidden md:block">
          <div className="relative border border-white/10 rounded overflow-hidden">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              placeholder="SKU oder Artikel suchen..."
              className="pl-9 pr-3 py-1.5 bg-white/5 border-none text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 transition-all focus:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

        <div className="hidden sm:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></div>
            <span className="text-xs mono font-bold text-orange-500">WARNUNGEN AKTIV</span>
        </div>

        <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block"></div>

        <button 
          onClick={() => navigate('/inventory/new')} 
          className="bg-zinc-800 hover:bg-zinc-700 transition-colors bevel-outer px-4 py-1.5 rounded text-xs font-bold mono text-white"
        >
            + NEUER ARTIKEL
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <User className="h-4 w-4 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#1a1a1e] border-white/10 text-zinc-300">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold text-white uppercase tracking-wider">{user?.user_metadata?.display_name || 'Benutzer'}</p>
                <p className="text-[10px] mono text-zinc-500">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="hover:bg-white/5 focus:bg-white/5 cursor-pointer text-xs">
              <User className="mr-2 h-3.5 w-3.5" />
              Einstellungen
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer text-xs">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
