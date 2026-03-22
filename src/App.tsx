import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Providers } from './app/providers'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { InventoryListPage } from '@/features/inventory/pages/InventoryListPage'
import { InventoryFormPage } from '@/features/inventory/pages/InventoryFormPage'
import { CategoriesPage } from '@/features/categories/pages/CategoriesPage'
import { LocationsPage } from '@/features/locations/pages/LocationsPage'
import { ListingsPage } from '@/features/listings/pages/ListingsPage'
import { SalesPage } from '@/features/sales/pages/SalesPage'
import { FinancesOverviewPage } from '@/features/finances/pages/FinancesOverviewPage'
import { ProfitLossPage } from '@/features/finances/pages/ProfitLossPage'
import { ExpensesPage } from '@/features/finances/pages/ExpensesPage'
import { TaxOverviewPage } from '@/features/taxes/pages/TaxOverviewPage'
import { EuerPage } from '@/features/taxes/pages/EuerPage'
import { VatPage } from '@/features/taxes/pages/VatPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'

function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryListPage />} />
            <Route path="/inventory/new" element={<InventoryFormPage />} />
            <Route path="/inventory/:id/edit" element={<InventoryFormPage />} />
            <Route path="/inventory/categories" element={<CategoriesPage />} />
            <Route path="/inventory/locations" element={<LocationsPage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/finances" element={<FinancesOverviewPage />} />
            <Route path="/finances/profit-loss" element={<ProfitLossPage />} />
            <Route path="/finances/expenses" element={<ExpensesPage />} />
            <Route path="/taxes" element={<TaxOverviewPage />} />
            <Route path="/taxes/euer" element={<EuerPage />} />
            <Route path="/taxes/vat" element={<VatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Providers>
  )
}

export default App
