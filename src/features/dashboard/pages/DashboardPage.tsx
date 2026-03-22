import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Package, Euro, ShoppingCart, DollarSign } from 'lucide-react'
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
} from 'recharts'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']

interface KPIData {
  todaySales: number
  todayRevenue: number
  todayProfit: number
  monthSales: number
  monthRevenue: number
  monthProfit: number
  inventoryCount: number
  inventoryValue: number
}

interface ChartData {
  name: string
  umsatz: number
  gewinn: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const userId = user?.id

  const { data: kpiData, isLoading: kpiLoading } = useQuery<KPIData>({
    queryKey: ['dashboard', 'kpis', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const today = new Date().toISOString().split('T')[0]
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [todaySales, monthSales, inventory] = await Promise.all([
        supabase
          .from('sales')
          .select('sale_price, shipping_income, net_profit')
          .eq('user_id', userId)
          .gte('sold_at', today + 'T00:00:00')
          .lte('sold_at', today + 'T23:59:59')
          .not('status', 'in', '(returned,refunded)'),
        supabase
          .from('sales')
          .select('sale_price, shipping_income, net_profit')
          .eq('user_id', userId)
          .gte('sold_at', startOfMonth)
          .not('status', 'in', '(returned,refunded)'),
        supabase
          .from('inventory_items')
          .select('quantity, purchase_price')
          .eq('user_id', userId),
      ])

      const todaySalesCount = todaySales.data?.length || 0
      const todayRevenue = todaySales.data?.reduce((sum, s) => sum + (s.sale_price || 0) + (s.shipping_income || 0), 0) || 0
      const todayProfit = todaySales.data?.reduce((sum, s) => sum + (s.net_profit || 0), 0) || 0

      const monthSalesCount = monthSales.data?.length || 0
      const monthRevenue = monthSales.data?.reduce((sum, s) => sum + (s.sale_price || 0) + (s.shipping_income || 0), 0) || 0
      const monthProfit = monthSales.data?.reduce((sum, s) => sum + (s.net_profit || 0), 0) || 0

      const inventoryCount = inventory.data?.length || 0
      const inventoryValue = inventory.data?.reduce((sum, i) => sum + ((i.quantity || 0) * (i.purchase_price || 0)), 0) || 0

      return {
        todaySales: todaySalesCount,
        todayRevenue,
        todayProfit,
        monthSales: monthSalesCount,
        monthRevenue,
        monthProfit,
        inventoryCount,
        inventoryValue,
      }
    },
    enabled: !!userId,
  })

  const { data: chartData, isLoading: chartLoading } = useQuery<ChartData[]>({
    queryKey: ['dashboard', 'chart', userId],
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

  const { data: statusData } = useQuery({
    queryKey: ['dashboard', 'status', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data } = await supabase
        .from('inventory_items')
        .select('status')
        .eq('user_id', userId)

      const counts = { in_stock: 0, listed: 0, sold: 0, reserved: 0, returned: 0 }
      data?.forEach((item: any) => {
        if (counts.hasOwnProperty(item.status)) {
          counts[item.status as keyof typeof counts]++
        }
      })

      return Object.entries(counts)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }))
    },
    enabled: !!userId,
  })

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Guten Morgen'
    if (hour < 18) return 'Guten Tag'
    return 'Guten Abend'
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {greeting()}, {user?.user_metadata?.display_name || 'Benutzer'}!
        </h1>
        <p className="text-muted-foreground mt-1">Hier ist Ihre Übersicht</p>
      </div>

      {kpiLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Heute</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData?.todaySales || 0} Verkäufe</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(kpiData?.todayRevenue || 0)} Umsatz
              </p>
              <p className={`text-xs ${(kpiData?.todayProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(kpiData?.todayProfit || 0) >= 0 ? '+' : ''}{formatCurrency(kpiData?.todayProfit || 0)} Gewinn
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Dieser Monat</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData?.monthSales || 0} Verkäufe</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(kpiData?.monthRevenue || 0)} Umsatz
              </p>
              <p className={`text-xs ${(kpiData?.monthProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(kpiData?.monthProfit || 0) >= 0 ? '+' : ''}{formatCurrency(kpiData?.monthProfit || 0)} Gewinn
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Auf Lager</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData?.inventoryCount || 0} Artikel</div>
              <p className="text-xs text-muted-foreground">
                Wert: {formatCurrency(kpiData?.inventoryValue || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ø Gewinn/Verkauf</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData?.monthSales && kpiData.monthSales > 0
                  ? formatCurrency(kpiData.monthProfit / kpiData.monthSales)
                  : formatCurrency(0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {(kpiData?.monthRevenue && kpiData.monthSales > 0
                  ? ((kpiData.monthProfit / kpiData.monthRevenue) * 100).toFixed(1)
                  : 0)}% Marge
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Umsatz & Gewinn (12 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="umsatz"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="gewinn"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Noch keine Daten verfügbar
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bestandsübersicht</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData && statusData.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                    >
                      {statusData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Noch keine Artikel im Lager
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
