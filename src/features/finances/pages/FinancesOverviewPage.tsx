import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { TrendingUp, TrendingDown, Euro, Receipt, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']

const EXPENSE_CATEGORIES = [
  { value: 'shipping_materials', label: 'Versandmaterial' },
  { value: 'tools', label: 'Werkzeug' },
  { value: 'software', label: 'Software' },
  { value: 'ebay_store_fees', label: 'eBay-Shop' },
  { value: 'office_supplies', label: 'Bürobedarf' },
  { value: 'travel', label: 'Fahrtkosten' },
  { value: 'packaging', label: 'Verpackung' },
  { value: 'other', label: 'Sonstiges' },
]

type DateRange = 'today' | '7days' | '30days' | 'thisMonth' | 'thisYear' | 'all'

export function FinancesOverviewPage() {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState<DateRange>('thisYear')

  const getDateRange = () => {
    const now = new Date()
    let startDate = new Date(now.getFullYear(), 0, 1)

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
    }

    return { start: startDate.toISOString(), end: now.toISOString() }
  }

  const { data: salesData } = useQuery({
    queryKey: ['finances', 'sales', userId, dateRange],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { start, end } = getDateRange()

      const { data } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', userId)
        .gte('sold_at', start)
        .lte('sold_at', end)
        .not('status', 'in', '(returned,refunded)')

      const revenue = data?.reduce((sum, s) => sum + s.sale_price + s.shipping_income, 0) || 0
      const purchaseCosts = data?.reduce((sum, s) => sum + s.purchase_price, 0) || 0
      const ebayFees = data?.reduce((sum, s) => sum + s.ebay_fees, 0) || 0
      const paymentFees = data?.reduce((sum, s) => sum + s.payment_fees, 0) || 0
      const shippingCosts = data?.reduce((sum, s) => sum + s.shipping_cost_actual, 0) || 0
      const packagingCosts = data?.reduce((sum, s) => sum + s.packaging_cost, 0) || 0
      const otherCosts = data?.reduce((sum, s) => sum + s.other_costs, 0) || 0
      const profit = data?.reduce((sum, s) => sum + s.net_profit, 0) || 0
      const salesCount = data?.length || 0

      return {
        revenue,
        purchaseCosts,
        ebayFees,
        paymentFees,
        shippingCosts,
        packagingCosts,
        otherCosts,
        profit,
        salesCount,
        totalCosts: purchaseCosts + ebayFees + paymentFees + shippingCosts + packagingCosts + otherCosts,
      }
    },
    enabled: !!userId,
  })

  const { data: expensesData } = useQuery({
    queryKey: ['finances', 'expenses', userId, dateRange],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { start, end } = getDateRange()

      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .gte('date', start.split('T')[0])
        .lte('date', end.split('T')[0])

      const total = data?.reduce((sum, e) => sum + e.amount, 0) || 0
      const byCategory: Record<string, number> = {}
      data?.forEach((e) => {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
      })

      return { total, byCategory, count: data?.length || 0 }
    },
    enabled: !!userId,
  })

  const { data: chartData } = useQuery({
    queryKey: ['finances', 'chart', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data } = await supabase
        .from('v_monthly_summary')
        .select('month, gross_revenue, net_profit')
        .eq('user_id', userId)
        .order('month', { ascending: true })
        .limit(12)

      return (data || []).map((d: any) => ({
        name: new Date(d.month).toLocaleDateString('de-DE', { month: 'short' }),
        umsatz: d.gross_revenue || 0,
        gewinn: d.net_profit || 0,
      }))
    },
    enabled: !!userId,
  })

  const { data: categoryData } = useQuery({
    queryKey: ['finances', 'categories', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data } = await supabase
        .from('v_category_performance')
        .select('category_name, total_revenue, total_profit')
        .eq('user_id', userId)
        .order('total_revenue', { ascending: false })
        .limit(5)

      return (data || []).map((d: any) => ({
        name: d.category_name || 'Unkategorisiert',
        value: d.total_revenue || 0,
        profit: d.total_profit || 0,
      }))
    },
    enabled: !!userId,
  })

  const profitMargin = salesData && salesData.revenue > 0
    ? (salesData.profit / salesData.revenue) * 100
    : 0

  const costBreakdown = salesData ? [
    { name: 'Wareneinsatz', value: salesData.purchaseCosts },
    { name: 'eBay-Gebühren', value: salesData.ebayFees },
    { name: 'Zahlungsgebühren', value: salesData.paymentFees },
    { name: 'Versand', value: salesData.shippingCosts },
    { name: 'Verpackung', value: salesData.packagingCosts },
    { name: 'Sonstiges', value: salesData.otherCosts },
  ].filter(c => c.value > 0) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finanzen</h1>
          <p className="text-muted-foreground">
            Übersicht über Ihre Einnahmen und Ausgaben
          </p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Heute</SelectItem>
            <SelectItem value="7days">Letzte 7 Tage</SelectItem>
            <SelectItem value="30days">Letzte 30 Tage</SelectItem>
            <SelectItem value="thisMonth">Dieser Monat</SelectItem>
            <SelectItem value="thisYear">Dieses Jahr</SelectItem>
            <SelectItem value="all">Alle Zeit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Umsatz</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(salesData?.revenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {salesData?.salesCount || 0} Verkäufe
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Kosten</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency((salesData?.totalCosts || 0) + (expensesData?.total || 0))}</div>
            <p className="text-xs text-muted-foreground">
              {(salesData?.totalCosts || 0) > 0 ? 'Verkauf + ' : ''}Ausgaben
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gewinn</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-2xl font-bold',
              (salesData?.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {formatCurrency(salesData?.profit || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(expensesData?.total || 0) > 0 && `(-${formatCurrency(expensesData?.total || 0)} Ausgaben)`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Marge</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profitMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Gewinn / Umsatz
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Umsatz & Gewinn (12 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="umsatz" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="gewinn" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Noch keine Daten
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Kostenaufschlüsselung</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/finances/expenses')}>
              <Receipt className="mr-2 h-4 w-4" />
              Ausgaben
            </Button>
          </CardHeader>
          <CardContent>
            {expensesData && expensesData.total > 0 && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Betriebsausgaben</p>
                <p className="text-lg font-bold">{formatCurrency(expensesData.total)}</p>
              </div>
            )}
            {costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={costBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {costBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                Keine Kosten erfasst
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Top 5 Kategorien</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/finances/profit-loss')}>Details</Button>
        </CardHeader>
        <CardContent>
          {categoryData && categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Bar dataKey="value" fill="#3b82f6" name="Umsatz" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              Keine Kategorien vorhanden
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
