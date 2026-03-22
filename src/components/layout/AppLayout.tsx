import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sidebar as MobileSidebar } from './Sidebar'

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <MobileSidebar />
        </SheetContent>
      </Sheet>
    </div>
  )
}
