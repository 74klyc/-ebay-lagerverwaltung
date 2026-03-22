import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Download, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Sale {
  id: string
  sale_price: number
  shipping_income: number
  purchase_price: number
  ebay_fees: number
  shipping_cost_actual: number
  payment_fees: number
  packaging_cost: number
  other_costs: number
  net_profit: number
  sold_at: string
  item?: {
    title: string
    sku: string
  }
  category?: {
    name: string
  }
}

export function ProfitLossPage() {
  const { user } = useAuth()
  const userId = user?.id

  const [search, setSearch] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [profitFilter, setProfitFilter] = useState<'all' | 'positive' | 'negative'>('all')

  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ['profit-loss', userId, year],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data } = await supabase
        .from('v_item_profitability')
        .select(`
          sale_id,
          sale_price,
          purchase_price,
          ebay_fees,
          shipping_cost_actual,
          net_profit,
          sold_at,
          item_title,
          sku,
          category_name
        `)
        .eq('user_id', userId)
        .gte('sold_at', `${year}-01-01`)
        .lte('sold_at', `${year}-12-31`)
        .order('sold_at', { ascending: false })

      return (data || []).map((s: any) => ({
        id: s.sale_id,
        sale_price: s.sale_price,
        shipping_income: 0,
        purchase_price: s.purchase_price,
        ebay_fees: s.ebay_fees,
        shipping_cost_actual: s.shipping_cost_actual,
        payment_fees: 0,
        packaging_cost: 0,
        other_costs: 0,
        net_profit: s.net_profit,
        sold_at: s.sold_at,
        item: { title: s.item_title, sku: s.sku },
        category: { name: s.category_name },
      }))
    },
    enabled: !!userId,
  })

  const filteredSales = sales?.filter((sale) => {
    if (search) {
      const title = sale.item?.title?.toLowerCase() || ''
      if (!title.includes(search.toLowerCase())) return false
    }
    if (profitFilter === 'positive' && sale.net_profit < 0) return false
    if (profitFilter === 'negative' && sale.net_profit >= 0) return false
    return true
  })

  const totals = {
    revenue: filteredSales?.reduce((sum, s) => sum + s.sale_price, 0) || 0,
    purchaseCosts: filteredSales?.reduce((sum, s) => sum + s.purchase_price, 0) || 0,
    ebayFees: filteredSales?.reduce((sum, s) => sum + s.ebay_fees, 0) || 0,
    shippingCosts: filteredSales?.reduce((sum, s) => sum + s.shipping_cost_actual, 0) || 0,
    otherCosts: filteredSales?.reduce((sum, s) => sum + s.other_costs + s.payment_fees + s.packaging_cost, 0) || 0,
    profit: filteredSales?.reduce((sum, s) => sum + s.net_profit, 0) || 0,
    count: filteredSales?.length || 0,
  }

  const exportCSV = () => {
    if (!filteredSales || filteredSales.length === 0) return

    const headers = ['Datum', 'Artikel', 'SKU', 'Kategorie', 'VK', 'EK', 'eBay-Gebühren', 'Versand', 'Sonstiges', 'Gewinn', 'ROI']
    const rows = filteredSales.map((s) => [
      formatDate(s.sold_at),
      s.item?.title || '',
      s.item?.sku || '',
      s.category?.name || '',
      s.sale_price.toFixed(2),
      s.purchase_price.toFixed(2),
      s.ebay_fees.toFixed(2),
      s.shipping_cost_actual.toFixed(2),
      (s.other_costs + s.payment_fees + s.packaging_cost).toFixed(2),
      s.net_profit.toFixed(2),
      s.purchase_price > 0 ? ((s.net_profit / s.purchase_price) * 100).toFixed(1) + '%' : '0%',
    ])

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gewinn-verlust-${year}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gewinn & Verlust</h1>
          <p className="text-muted-foreground">
            Detaillierte Übersicht aller Verkäufe mit Gewinnberechnung
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />
          CSV exportieren
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Umsatz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
            <p className="text-xs text-muted-foreground">{totals.count} Verkäufe</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Kosten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatCurrency(totals.purchaseCosts + totals.ebayFees + totals.shippingCosts + totals.otherCosts)}
            </div>
            <p className="text-xs text-muted-foreground">Gesamtkosten</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gewinn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-2xl font-bold',
              totals.profit >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {formatCurrency(totals.profit)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}% Marge
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ø Gewinn/Verkauf</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.count > 0 ? formatCurrency(totals.profit / totals.count) : formatCurrency(0)}
            </div>
            <p className="text-xs text-muted-foreground">Durchschnitt</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nach Artikel suchen..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - i
                  return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                })}
              </SelectContent>
            </Select>
            <Select value={profitFilter} onValueChange={(v) => setProfitFilter(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="positive">Nur Gewinn</SelectItem>
                <SelectItem value="negative">Nur Verlust</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : filteredSales && filteredSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">VK</TableHead>
                  <TableHead className="text-right">EK</TableHead>
                  <TableHead className="text-right">Gebühren</TableHead>
                  <TableHead className="text-right">Gewinn</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => {
                  const roi = sale.purchase_price > 0
                    ? (sale.net_profit / sale.purchase_price) * 100
                    : 0

                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(sale.sold_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {sale.item?.title || 'Unbekannt'}
                        {sale.item?.sku && (
                          <p className="text-xs text-muted-foreground">{sale.item.sku}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.category?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(sale.sale_price)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(sale.purchase_price)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(sale.ebay_fees + sale.shipping_cost_actual)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right font-medium',
                        sale.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {formatCurrency(sale.net_profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={roi >= 0 ? 'success' : 'destructive'} className="flex items-center justify-end gap-1">
                          {roi >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {roi.toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Keine Verkäufe im Jahr {year}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
