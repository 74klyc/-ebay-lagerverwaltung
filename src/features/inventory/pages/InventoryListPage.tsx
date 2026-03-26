import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Plus, Search, Pencil, Trash2, Package, MoreHorizontal, Image as ImageIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'

const ITEM_STATUS_CONFIG = {
  in_stock: { label: 'Auf Lager', variant: 'success' as const },
  listed: { label: 'Gelistet', variant: 'info' as const },
  sold: { label: 'Verkauft', variant: 'warning' as const },
  reserved: { label: 'Reserviert', variant: 'secondary' as const },
  returned: { label: 'Retoure', variant: 'destructive' as const },
}

const ITEM_CONDITION_CONFIG = {
  new: 'Neu',
  like_new: 'Wie Neu',
  good: 'Gut',
  acceptable: 'Akzeptabel',
  parts: 'Defekt/Ersatzteile',
}

export function InventoryListPage() {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [deleteItem, setDeleteItem] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', userId, debouncedSearch, statusFilter],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      let query = supabase
        .from('inventory_items')
        .select('*, categories(name), storage_locations(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (debouncedSearch) {
        query = query.ilike('title', `%${debouncedSearch}%`)
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query.limit(100)
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast({ title: 'Artikel gelöscht' })
      setDeleteItem(null)
    },
    onError: (error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Lager</h1>
          <p className="text-muted-foreground">
            {items?.length || 0} Artikel insgesamt
          </p>
        </div>
        <Button onClick={() => navigate('/inventory/new')} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Neuer Artikel
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Artikel suchen..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="in_stock">Auf Lager</SelectItem>
            <SelectItem value="listed">Gelistet</SelectItem>
            <SelectItem value="sold">Verkauft</SelectItem>
            <SelectItem value="reserved">Reserviert</SelectItem>
            <SelectItem value="returned">Retoure</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Bild</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">EK</TableHead>
                  <TableHead className="text-right">Zielpreis</TableHead>
                  <TableHead className="text-center">Menge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.images && item.images.length > 0 ? (
                        <img
                          src={item.images[0]}
                          alt={item.title}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to={`/inventory/${item.id}/edit`}
                        className="hover:underline"
                      >
                        {item.title}
                      </Link>
                      {item.categories && (
                        <p className="text-xs text-muted-foreground">
                          {item.categories.name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.sku || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.purchase_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.target_price)}
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={ITEM_STATUS_CONFIG[item.status as keyof typeof ITEM_STATUS_CONFIG]?.variant || 'secondary'}>
                        {ITEM_STATUS_CONFIG[item.status as keyof typeof ITEM_STATUS_CONFIG]?.label || item.status}
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
                          <DropdownMenuItem onSelect={() => navigate(`/inventory/${item.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteItem(item.id)}
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
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Artikel gefunden</h3>
          <p className="text-muted-foreground mb-4">
            {search ? 'Versuchen Sie einen anderen Suchbegriff' : 'Fügen Sie Ihren ersten Artikel hinzu'}
          </p>
          <Button onClick={() => navigate('/inventory/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Artikel
          </Button>
        </Card>
      )}

      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Artikel löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem)}
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
