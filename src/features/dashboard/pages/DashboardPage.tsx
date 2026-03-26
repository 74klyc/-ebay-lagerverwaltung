import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'
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

  return (
    <div className="space-y-8 max-w-7xl">
      {kpiLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white">
          <div className="brushed-metal bevel-outer p-6 rounded-lg relative group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"></path></svg>
              </div>
              <p className="text-[10px] mono text-zinc-500 uppercase mb-2 tracking-widest">Heute: Verkäufe / Umsatz</p>
              <h3 className="text-3xl font-extrabold mono italic tracking-tighter">{kpiData?.todaySales || 0}</h3>
              <p className="text-sm font-medium">{formatCurrency(kpiData?.todayRevenue || 0)}</p>
              <div className="mt-4 h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[65%] shadow-[0_0_10px_#3b82f6]"></div>
              </div>
          </div>
          
          <div className="brushed-metal bevel-outer p-6 rounded-lg">
              <p className="text-[10px] mono text-zinc-500 uppercase mb-2 tracking-widest">Umsatz (Monat)</p>
              <h3 className="text-3xl font-extrabold mono italic tracking-tighter">{formatCurrency(kpiData?.monthRevenue || 0)}</h3>
              <div className="flex items-center gap-1 mt-4 text-emerald-500 text-[10px] mono font-bold">
                  <span>{kpiData?.monthProfit && kpiData.monthProfit >= 0 ? '▲' : '▼'} {formatCurrency(kpiData?.monthProfit || 0)} Gewinn</span>
              </div>
          </div>

          <div className="brushed-metal bevel-outer p-6 rounded-lg border-l-2 border-l-blue-500">
              <p className="text-[10px] mono text-zinc-500 uppercase mb-2 tracking-widest">Auf Lager</p>
              <h3 className="text-3xl font-extrabold mono italic tracking-tighter text-blue-400">{kpiData?.inventoryCount || 0}</h3>
              <p className="mt-4 text-zinc-600 text-[10px] mono">Wert: {formatCurrency(kpiData?.inventoryValue || 0)}</p>
          </div>

          <div className="brushed-metal bevel-outer p-6 rounded-lg">
              <p className="text-[10px] mono text-zinc-500 uppercase mb-2 tracking-widest">Ø Gewinn/Verkauf (Monat)</p>
              <h3 className="text-3xl font-extrabold mono italic tracking-tighter">
                {kpiData?.monthSales && kpiData.monthSales > 0
                  ? formatCurrency(kpiData.monthProfit / kpiData.monthSales)
                  : formatCurrency(0)}
              </h3>
              <p className="mt-4 text-zinc-600 text-[10px] mono">
                {(kpiData?.monthRevenue && kpiData.monthSales > 0
                  ? ((kpiData.monthProfit / kpiData.monthRevenue) * 100).toFixed(1)
                  : 0)}% Marge
              </p>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="brushed-metal bevel-outer rounded-lg overflow-hidden text-white">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Kürzliche Lagerbewegungen</h3>
              <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-zinc-700"></div>
                  <div className="h-2 w-2 rounded-full bg-zinc-700"></div>
              </div>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full industrial-grid text-left">
                  <thead>
                      <tr>
                          <th>SKU_ID</th>
                          <th>Artikelbezeichnung</th>
                          <th>Kategorie</th>
                          <th>Lagerort</th>
                          <th>Menge</th>
                          <th>Status</th>
                          <th className="text-right">Aktion</th>
                      </tr>
                  </thead>
                  <tbody className="mono text-xs">
                      <tr>
                          <td colSpan={7} className="py-8 text-center text-zinc-500 italic">
                              Aktuell keine aktuellen Lagerbewegungen verzeichnet.
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">
          <div className="brushed-metal bevel-outer p-6 rounded-lg h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                  <h4 className="text-[10px] mono text-zinc-400 uppercase tracking-widest">Umsatz & Gewinn (12 Monate)</h4>
                  <div className="flex gap-1">
                      <div className="w-1 h-3 bg-blue-500/40"></div>
                      <div className="w-1 h-3 bg-blue-500/60"></div>
                      <div className="w-1 h-3 bg-blue-500"></div>
                  </div>
              </div>
              <div className="flex-1 w-full h-full text-xs">
                {chartLoading ? (
                  <Skeleton className="h-full w-full bg-white/5" />
                ) : chartData && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d2d33" />
                      <XAxis dataKey="name" stroke="#71717a" />
                      <YAxis stroke="#71717a" />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{backgroundColor: '#1a1a1e', border: '1px solid #2d2d33'}} />
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
                  <div className="flex h-full items-center justify-center text-zinc-500">
                    Noch keine Daten verfügbar
                  </div>
                )}
              </div>
          </div>
          <div className="brushed-metal bevel-outer p-6 rounded-lg flex flex-col justify-center items-center relative h-[400px]">
              <h4 className="text-[10px] mono text-zinc-400 uppercase tracking-widest absolute top-6 left-6">Bestandsübersicht</h4>
              <div className="w-full h-full text-xs pt-10">
                {statusData && statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
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
                      <Tooltip contentStyle={{backgroundColor: '#1a1a1e', border: '1px solid #2d2d33'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-500">
                    Noch keine Artikel im Lager
                  </div>
                )}
              </div>
          </div>
      </div>
    </div>
  )
}
