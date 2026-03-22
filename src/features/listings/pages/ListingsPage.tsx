import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
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
  Tag,
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  Image as ImageIcon,
  ShoppingCart,
  DollarSign,
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
import type { listing_platform, listing_type, listing_status } from '@/types/database'

const PLATFORM_CONFIG: Record<string, { label: string }> = {
  ebay_de: { label: 'eBay DE' },
  ebay_com: { label: 'eBay COM' },
  kleinanzeigen: { label: 'Kleinanzeigen' },
  other: { label: 'Andere' },
}

const LISTING_STATUS_CONFIG: Record<listing_status, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' | 'info' }> = {
  draft: { label: 'Entwurf', variant: 'secondary' },
  active: { label: 'Aktiv', variant: 'success' },
  ended: { label: 'Beendet', variant: 'warning' },
  sold: { label: 'Verkauft', variant: 'info' },
  cancelled: { label: 'Abgebrochen', variant: 'destructive' },
}

interface Listing {
  id: string
  user_id: string
  item_id: string
  ebay_item_id: string
  platform: listing_platform
  listing_type: listing_type
  start_price: number
  buy_it_now_price: number
  current_bid: number
  shipping_cost: number
  watchers: number
  views: number
  ebay_fee_percent: number
  ebay_fees_calculated: number
  status: listing_status
  listed_at: string | null
  ends_at: string | null
  ebay_category: string
  notes: string
  created_at: string
  updated_at: string
  item?: {
    title: string
    images: string[]
  }
}

interface ListingFormData {
  item_id: string
  platform: listing_platform
  listing_type: listing_type
  start_price: number
  buy_it_now_price: number
  shipping_cost: number
  ebay_fee_percent: number
  ebay_category: string
  status: listing_status
  notes: string
}

export function ListingsPage() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ListingFormData>({
    item_id: '',
    platform: 'ebay_de',
    listing_type: 'fixed_price',
    start_price: 0,
    buy_it_now_price: 0,
    shipping_cost: 0,
    ebay_fee_percent: 13,
    ebay_category: '',
    status: 'draft',
    notes: '',
  })

  const { data: listings, isLoading } = useQuery<Listing[]>({
    queryKey: ['listings', userId, statusFilter],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      let query = supabase
        .from('listings')
        .select('*, item:inventory_items(title, images)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
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
        .select('id, title, purchase_price')
        .eq('user_id', userId)
        .eq('status', 'in_stock')
        .order('title')
      return data || []
    },
    enabled: !!userId,
  })

  const filteredListings = listings?.filter((listing) => {
    if (search) {
      const itemTitle = listing.item?.title?.toLowerCase() || ''
      if (!itemTitle.includes(search.toLowerCase())) return false
    }
    if (platformFilter !== 'all' && listing.platform !== platformFilter) return false
    return true
  })

  const statusCounts = {
    all: listings?.length || 0,
    draft: listings?.filter((l) => l.status === 'draft').length || 0,
    active: listings?.filter((l) => l.status === 'active').length || 0,
    ended: listings?.filter((l) => l.status === 'ended').length || 0,
    sold: listings?.filter((l) => l.status === 'sold').length || 0,
  }

  const openCreateDialog = () => {
    setEditingListing(null)
    setFormData({
      item_id: '',
      platform: 'ebay_de',
      listing_type: 'fixed_price',
      start_price: 0,
      buy_it_now_price: 0,
      shipping_cost: 0,
      ebay_fee_percent: 13,
      ebay_category: '',
      status: 'draft',
      notes: '',
    })
    setDialogOpen(true)
  }

  const openEditDialog = (listing: Listing) => {
    setEditingListing(listing)
    setFormData({
      item_id: listing.item_id,
      platform: listing.platform,
      listing_type: listing.listing_type,
      start_price: listing.start_price,
      buy_it_now_price: listing.buy_it_now_price || 0,
      shipping_cost: listing.shipping_cost,
      ebay_fee_percent: listing.ebay_fee_percent,
      ebay_category: listing.ebay_category,
      status: listing.status,
      notes: listing.notes || '',
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: ListingFormData) => {
      if (!userId) throw new Error('Not authenticated')

      const selectedItem = items?.find((i) => i.id === data.item_id)

      if (editingListing) {
        const { error } = await supabase
          .from('listings')
          .update({
            item_id: data.item_id,
            platform: data.platform,
            listing_type: data.listing_type,
            start_price: data.start_price,
            buy_it_now_price: data.buy_it_now_price,
            shipping_cost: data.shipping_cost,
            ebay_fee_percent: data.ebay_fee_percent,
            ebay_category: data.ebay_category,
            status: data.status,
            notes: data.notes,
          })
          .eq('id', editingListing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('listings').insert({
          user_id: userId,
          item_id: data.item_id,
          platform: data.platform,
          listing_type: data.listing_type,
          start_price: data.start_price,
          buy_it_now_price: data.buy_it_now_price,
          shipping_cost: data.shipping_cost,
          ebay_fee_percent: data.ebay_fee_percent,
          ebay_category: data.ebay_category,
          status: data.status,
          notes: data.notes,
        })
        if (error) throw error

        if (selectedItem) {
          await supabase
            .from('inventory_items')
            .update({ status: 'listed' })
            .eq('id', data.item_id)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast({ title: editingListing ? 'Listing aktualisiert' : 'Listing erstellt' })
      setDialogOpen(false)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('listings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      toast({ title: 'Listing gelöscht' })
      setDeleteId(null)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const estimatedFees = calculateEbayFees(formData.start_price, formData.ebay_fee_percent)
  const estimatedProfit = formData.start_price - estimatedFees

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Listings</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre eBay-Listings
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Listing
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">
            Alle ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Entwürfe ({statusCounts.draft})
          </TabsTrigger>
          <TabsTrigger value="active">
            Aktiv ({statusCounts.active})
          </TabsTrigger>
          <TabsTrigger value="ended">
            Beendet ({statusCounts.ended})
          </TabsTrigger>
          <TabsTrigger value="sold">
            Verkauft ({statusCounts.sold})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          <div className="flex flex-col gap-4 sm:flex-row mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nach Artikel suchen..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Plattform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Plattformen</SelectItem>
                <SelectItem value="ebay_de">eBay DE</SelectItem>
                <SelectItem value="ebay_com">eBay COM</SelectItem>
                <SelectItem value="kleinanzeigen">Kleinanzeigen</SelectItem>
                <SelectItem value="other">Andere</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : filteredListings && filteredListings.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Bild</TableHead>
                      <TableHead>Artikel</TableHead>
                      <TableHead>Plattform</TableHead>
                      <TableHead className="text-right">Preis</TableHead>
                      <TableHead className="text-right">Gebühr</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell>
                          {listing.item?.images && listing.item.images.length > 0 ? (
                            <img
                              src={listing.item.images[0]}
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
                          {listing.item?.title || 'Unbekannt'}
                          <p className="text-xs text-muted-foreground">
                            {listing.ebay_category || 'Keine Kategorie'}
                          </p>
                        </TableCell>
                        <TableCell>
                          {PLATFORM_CONFIG[listing.platform]?.label}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(listing.start_price)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(listing.ebay_fees_calculated)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={LISTING_STATUS_CONFIG[listing.status]?.variant || 'secondary'}>
                            {LISTING_STATUS_CONFIG[listing.status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(listing)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => navigate(`/sales/new?listing_id=${listing.id}`)}>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Als verkauft
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteId(listing.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
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
              <Tag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Keine Listings gefunden</h3>
              <p className="text-muted-foreground mb-4">
                Erstellen Sie Ihr erstes Listing
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Neues Listing
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingListing ? 'Listing bearbeiten' : 'Neues Listing'}
            </DialogTitle>
            <DialogDescription>
              {editingListing
                ? 'Bearbeiten Sie die Listing-Details'
                : 'Erstellen Sie ein neues Listing'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Artikel</Label>
                <Select
                  value={formData.item_id}
                  onValueChange={(v) => setFormData({ ...formData, item_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Artikel auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title} ({formatCurrency(item.purchase_price)} EK)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plattform</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(v) => setFormData({ ...formData, platform: v as listing_platform })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ebay_de">eBay DE</SelectItem>
                      <SelectItem value="ebay_com">eBay COM</SelectItem>
                      <SelectItem value="kleinanzeigen">Kleinanzeigen</SelectItem>
                      <SelectItem value="other">Andere</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={formData.listing_type}
                    onValueChange={(v) => setFormData({ ...formData, listing_type: v as listing_type })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_price">Festpreis</SelectItem>
                      <SelectItem value="auction">Auktion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start-/Festpreis (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.start_price || ''}
                    onChange={(e) => setFormData({ ...formData, start_price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SOFORT-Kauf (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.buy_it_now_price || ''}
                    onChange={(e) => setFormData({ ...formData, buy_it_now_price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Versandkosten (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.shipping_cost || ''}
                    onChange={(e) => setFormData({ ...formData, shipping_cost: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>eBay-Gebühr (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.ebay_fee_percent || ''}
                    onChange={(e) => setFormData({ ...formData, ebay_fee_percent: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>eBay-Kategorie</Label>
                <Input
                  value={formData.ebay_category}
                  onChange={(e) => setFormData({ ...formData, ebay_category: e.target.value })}
                  placeholder="z.B. Handy/Smartphone"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as listing_status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="ended">Beendet</SelectItem>
                    <SelectItem value="sold">Verkauft</SelectItem>
                    <SelectItem value="cancelled">Abgebrochen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Gebührenrechner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Verkaufspreis</span>
                    <span className="font-medium">{formatCurrency(formData.start_price)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">eBay-Gebühr ({formData.ebay_fee_percent}%)</span>
                    <span className="text-red-600">-{formatCurrency(estimatedFees)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Versandkosten</span>
                    <span className="text-muted-foreground">-{formatCurrency(formData.shipping_cost)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Geschätzter Erlös</span>
                    <span className={cn(estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {formatCurrency(estimatedProfit)}
                    </span>
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
              disabled={!formData.item_id || !formData.start_price || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Listing löschen?</DialogTitle>
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
