import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { calculateEbayFees } from '@/lib/calculations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShoppingCart,
  Plus,
  Search,
  MoreHorizontal,
  Image as ImageIcon,
  Euro,
  TrendingUp,
  Package,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { sale_status } from '@/types/database'

const SALE_STATUS_CONFIG: Record<sale_status, { label: string; variant: 'secondary' | 'info' | 'warning' | 'success' | 'destructive' }> = {
  pending: { label: 'Offen', variant: 'secondary' },
  paid: { label: 'Bezahlt', variant: 'info' },
  shipped: { label: 'Versendet', variant: 'warning' },
  delivered: { label: 'Zugestellt', variant: 'success' },
  returned: { label: 'Retoure', variant: 'destructive' },
  refunded: { label: 'Erstattet', variant: 'destructive' },
}

interface Sale {
  id: string
  user_id: string
  item_id: string
  listing_id: string | null
  sale_price: number
  shipping_income: number
  purchase_price: number
  shipping_cost_actual: number
  ebay_fees: number
  payment_fees: number
  packaging_cost: number
  other_costs: number
  net_profit: number
  buyer_username: string
  buyer_note: string
  status: sale_status
  tracking_number: string
  carrier: string
  sold_at: string
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
  item?: {
    title: string
    images: string[]
  }
  listing?: {
    platform: string
  }
}

interface SaleFormData {
  item_id: string
  listing_id: string | null
  sale_price: number
  shipping_income: number
  purchase_price: number
  shipping_cost_actual: number
  ebay_fees: number
  payment_fees: number
  packaging_cost: number
  other_costs: number
  buyer_username: string
  status: sale_status
  tracking_number: string
  carrier: string
  sold_at: string
}

export function SalesPage() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const listingIdFromUrl = searchParams.get('listing_id')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<SaleFormData>({
    item_id: '',
    listing_id: null,
    sale_price: 0,
    shipping_income: 0,
    purchase_price: 0,
    shipping_cost_actual: 0,
    ebay_fees: 0,
    payment_fees: 0,
    packaging_cost: 0,
    other_costs: 0,
    buyer_username: '',
    status: 'pending',
    tracking_number: '',
    carrier: '',
    sold_at: new Date().toISOString().split('T')[0],
  })

  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ['sales', userId, statusFilter],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      let query = supabase
        .from('sales')
        .select('*, item:inventory_items(title, images, purchase_price), listing:listings(platform)')
        .eq('user_id', userId)
        .order('sold_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'returned_refunded') {
          query = query.in('status', ['returned', 'refunded'])
        } else {
          query = query.eq('status', statusFilter)
        }
      }

      const { data, error } = await query.limit(100)
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
  })

  const { data: items } = useQuery({
    queryKey: ['inventory', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data } = await supabase
        .from('inventory_items')
        .select('id, title, purchase_price, images')
        .eq('user_id', userId)
        .order('title')
      return data || []
    },
    enabled: !!userId,
  })

  const { data: listings } = useQuery({
    queryKey: ['listings', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data } = await supabase
        .from('listings')
        .select('id, item_id, start_price, platform, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (listingIdFromUrl && listings && listings.length > 0) {
      const listing = listings.find((l) => l.id === listingIdFromUrl)
      if (listing) {
        const item = items?.find((i) => i.id === listing.item_id)
        setFormData((prev) => ({
          ...prev,
          item_id: listing.item_id,
          listing_id: listing.id,
          sale_price: listing.start_price,
          purchase_price: item?.purchase_price || 0,
          ebay_fees: calculateEbayFees(listing.start_price, 13),
        }))
        setDialogOpen(true)
      }
    }
  }, [listingIdFromUrl, listings, items])

  const filteredSales = sales?.filter((sale) => {
    if (search) {
      const itemTitle = sale.item?.title?.toLowerCase() || ''
      if (!itemTitle.includes(search.toLowerCase())) return false
    }
    return true
  })

  const statusCounts = {
    all: sales?.length || 0,
    pending: sales?.filter((s) => s.status === 'pending').length || 0,
    paid: sales?.filter((s) => s.status === 'paid').length || 0,
    shipped: sales?.filter((s) => s.status === 'shipped').length || 0,
    delivered: sales?.filter((s) => s.status === 'delivered').length || 0,
    returned_refunded: sales?.filter((s) => ['returned', 'refunded'].includes(s.status)).length || 0,
  }

  const todaySales = sales?.filter((s) => {
    const today = new Date().toISOString().split('T')[0]
    return s.sold_at.startsWith(today)
  }) || []

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.sale_price + s.shipping_income, 0)
  const todayProfit = todaySales.reduce((sum, s) => sum + s.net_profit, 0)

  const monthSales = sales?.filter((s) => {
    const now = new Date()
    const saleDate = new Date(s.sold_at)
    return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear()
  }) || []

  const monthRevenue = monthSales.reduce((sum, s) => sum + s.sale_price + s.shipping_income, 0)
  const monthProfit = monthSales.reduce((sum, s) => sum + s.net_profit, 0)

  const openCreateDialog = () => {
    setEditingSale(null)
    setFormData({
      item_id: '',
      listing_id: null,
      sale_price: 0,
      shipping_income: 0,
      purchase_price: 0,
      shipping_cost_actual: 0,
      ebay_fees: 0,
      payment_fees: 0,
      packaging_cost: 0,
      other_costs: 0,
      buyer_username: '',
      status: 'pending',
      tracking_number: '',
      carrier: '',
      sold_at: new Date().toISOString().split('T')[0],
    })
    setDialogOpen(true)
  }

  const openEditDialog = (sale: Sale) => {
    setEditingSale(sale)
    setFormData({
      item_id: sale.item_id,
      listing_id: sale.listing_id,
      sale_price: sale.sale_price,
      shipping_income: sale.shipping_income,
      purchase_price: sale.purchase_price,
      shipping_cost_actual: sale.shipping_cost_actual,
      ebay_fees: sale.ebay_fees,
      payment_fees: sale.payment_fees,
      packaging_cost: sale.packaging_cost,
      other_costs: sale.other_costs,
      buyer_username: sale.buyer_username,
      status: sale.status,
      tracking_number: sale.tracking_number,
      carrier: sale.carrier,
      sold_at: sale.sold_at.split('T')[0],
    })
    setDialogOpen(true)
  }

  const handleItemChange = (itemId: string) => {
    const item = items?.find((i) => i.id === itemId)
    const listing = listings?.find((l) => l.item_id === itemId && l.status === 'active')

    setFormData((prev) => ({
      ...prev,
      item_id: itemId,
      listing_id: listing?.id || null,
      purchase_price: item?.purchase_price || 0,
    }))
  }

  const saveMutation = useMutation({
    mutationFn: async (data: SaleFormData) => {
      if (!userId) throw new Error('Not authenticated')

      if (editingSale) {
        const { error } = await supabase
          .from('sales')
          .update({
            item_id: data.item_id,
            listing_id: data.listing_id,
            sale_price: data.sale_price,
            shipping_income: data.shipping_income,
            purchase_price: data.purchase_price,
            shipping_cost_actual: data.shipping_cost_actual,
            ebay_fees: data.ebay_fees,
            payment_fees: data.payment_fees,
            packaging_cost: data.packaging_cost,
            other_costs: data.other_costs,
            buyer_username: data.buyer_username,
            status: data.status,
            tracking_number: data.tracking_number,
            carrier: data.carrier,
            sold_at: data.sold_at,
          })
          .eq('id', editingSale.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sales').insert({
          user_id: userId,
          item_id: data.item_id,
          listing_id: data.listing_id,
          sale_price: data.sale_price,
          shipping_income: data.shipping_income,
          purchase_price: data.purchase_price,
          shipping_cost_actual: data.shipping_cost_actual,
          ebay_fees: data.ebay_fees,
          payment_fees: data.payment_fees,
          packaging_cost: data.packaging_cost,
          other_costs: data.other_costs,
          buyer_username: data.buyer_username,
          status: data.status,
          tracking_number: data.tracking_number,
          carrier: data.carrier,
          sold_at: data.sold_at,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      toast({ title: editingSale ? 'Verkauf aktualisiert' : 'Verkauf erfasst' })
      setDialogOpen(false)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast({ title: 'Verkauf gelöscht' })
      setDeleteId(null)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const calculatedProfit = formData.sale_price + formData.shipping_income
    - formData.purchase_price
    - formData.ebay_fees
    - formData.shipping_cost_actual
    - formData.payment_fees
    - formData.packaging_cost
    - formData.other_costs

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Verkäufe</h1>
          <p className="text-muted-foreground">
            Verfolgen Sie Ihre Verkäufe und Gewinne
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Verkauf erfassen
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Heute</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaySales.length} Verkäufe</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(todayRevenue)} | +{formatCurrency(todayProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dieser Monat</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthSales.length} Verkäufe</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(monthRevenue)} | +{formatCurrency(monthProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Offen</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.pending}</div>
            <p className="text-xs text-muted-foreground">Unbezahlt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unversendet</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.paid + statusCounts.pending}</div>
            <p className="text-xs text-muted-foreground">Bezahlt & Offen</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Alle ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="pending">Offen ({statusCounts.pending})</TabsTrigger>
          <TabsTrigger value="paid">Bezahlt ({statusCounts.paid})</TabsTrigger>
          <TabsTrigger value="shipped">Versendet ({statusCounts.shipped})</TabsTrigger>
          <TabsTrigger value="delivered">Zugestellt ({statusCounts.delivered})</TabsTrigger>
          <TabsTrigger value="returned_refunded">Retouren ({statusCounts.returned_refunded})</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nach Artikel suchen..."
              className="pl-9 max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : filteredSales && filteredSales.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Bild</TableHead>
                      <TableHead>Artikel</TableHead>
                      <TableHead className="text-right">VK</TableHead>
                      <TableHead className="text-right">Gewinn</TableHead>
                      <TableHead>Käufer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {sale.item?.images && sale.item.images.length > 0 ? (
                            <img
                              src={sale.item.images[0]}
                              alt=""
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {sale.item?.title || 'Unbekannt'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(sale.sale_price)}
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-medium',
                          sale.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {formatCurrency(sale.net_profit)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.buyer_username || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={SALE_STATUS_CONFIG[sale.status]?.variant || 'secondary'}>
                            {SALE_STATUS_CONFIG[sale.status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(sale.sold_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(sale)}>
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteId(sale.id)}
                              >
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Keine Verkäufe gefunden</h3>
              <p className="text-muted-foreground mb-4">
                Erfassen Sie Ihren ersten Verkauf
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Verkauf erfassen
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSale ? 'Verkauf bearbeiten' : 'Verkauf erfassen'}
            </DialogTitle>
            <DialogDescription>
              {editingSale
                ? 'Bearbeiten Sie die Verkaufsdaten'
                : 'Erfassen Sie einen neuen Verkauf'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Artikel</Label>
                <Select
                  value={formData.item_id}
                  onValueChange={handleItemChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Artikel auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Verkaufspreis (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sale_price || ''}
                    onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Versand-Einnahmen (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.shipping_income || ''}
                    onChange={(e) => setFormData({ ...formData, shipping_income: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Einkaufspreis (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price || ''}
                    onChange={(e) => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>eBay-Gebühren (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.ebay_fees || ''}
                    onChange={(e) => setFormData({ ...formData, ebay_fees: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Versandkosten (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.shipping_cost_actual || ''}
                    onChange={(e) => setFormData({ ...formData, shipping_cost_actual: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zahlungsgebühren (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.payment_fees || ''}
                    onChange={(e) => setFormData({ ...formData, payment_fees: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Verpackung (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.packaging_cost || ''}
                    onChange={(e) => setFormData({ ...formData, packaging_cost: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sonstige Kosten (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.other_costs || ''}
                    onChange={(e) => setFormData({ ...formData, other_costs: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Käufer</Label>
                <Input
                  value={formData.buyer_username}
                  onChange={(e) => setFormData({ ...formData, buyer_username: e.target.value })}
                  placeholder="Benutzername"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as sale_status })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Offen</SelectItem>
                      <SelectItem value="paid">Bezahlt</SelectItem>
                      <SelectItem value="shipped">Versendet</SelectItem>
                      <SelectItem value="delivered">Zugestellt</SelectItem>
                      <SelectItem value="returned">Retoure</SelectItem>
                      <SelectItem value="refunded">Erstattet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={formData.sold_at}
                    onChange={(e) => setFormData({ ...formData, sold_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tracking-Nr.</Label>
                  <Input
                    value={formData.tracking_number}
                    onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                    placeholder="Paketnummer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dienstleister</Label>
                  <Input
                    value={formData.carrier}
                    onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                    placeholder="DHL, Hermes, etc."
                  />
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Gewinn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    'text-2xl font-bold',
                    calculatedProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatCurrency(calculatedProfit)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.item_id || !formData.sale_price || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verkauf löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
