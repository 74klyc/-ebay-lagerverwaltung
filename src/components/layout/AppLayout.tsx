import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Sidebar as MobileSidebar } from './Sidebar'

export function VisuallyHiddenTitle() {
  return <SheetTitle className="sr-only">Navigationsmenü</SheetTitle>
}

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="p-0 m-0 flex h-screen overflow-hidden">
      <Sidebar className="hidden lg:flex" />
      
      <main className="flex-1 flex flex-col h-full bg-[#0a0a0b] relative overflow-y-auto overflow-x-hidden w-full">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        
        <div className="p-4 md:p-8 space-y-4 md:space-y-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>

        <footer className="mt-auto border-t border-white/5 p-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] mono text-zinc-600 text-center sm:text-left">
            <div>EB_LAGER_SYS_V1.0.4 // SYSTEM_AKTIV</div>
            <div className="flex gap-4">
                <span>Latenz: 24MS</span>
                <span>Verfügbarkeit: 99.9%</span>
            </div>
        </footer>
      </main>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 border-r border-white/10 bg-[#0a0a0b]">
          <VisuallyHiddenTitle />
          <MobileSidebar />
        </SheetContent>
      </Sheet>

      {/* FLOATING ACTION OVERLAY */}
      <div className="fixed bottom-8 right-8 z-50">
          <button 
            onClick={() => navigate('/inventory/new')}
            className="h-14 w-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all hover:scale-110 active:scale-95 border-2 border-white/20"
          >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
          </button>
      </div>
    </div>
  )
}
