import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Warehouse,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  MoreHorizontal,
  MapPin,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { location_type } from '@/types/database'

interface StorageLocation {
  id: string
  user_id: string
  name: string
  description: string
  type: location_type
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  item_count?: number
  children?: StorageLocation[]
}

interface LocationFormData {
  name: string
  description: string
  type: location_type
  parent_id: string | null
}

const LOCATION_TYPES: { value: location_type; label: string }[] = [
  { value: 'warehouse', label: 'Lager' },
  { value: 'room', label: 'Raum' },
  { value: 'shelf', label: 'Regal' },
  { value: 'box', label: 'Box/Kiste' },
  { value: 'other', label: 'Sonstiges' },
]

export function LocationsPage() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    description: '',
    type: 'shelf',
    parent_id: null,
  })

  const { data: locations, isLoading } = useQuery<StorageLocation[]>({
    queryKey: ['locations', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

      if (error) throw error

      const { data: items } = await supabase
        .from('inventory_items')
        .select('location_id')
        .eq('user_id', userId)

      const itemCounts: Record<string, number> = {}
      items?.forEach((item) => {
        if (item.location_id) {
          itemCounts[item.location_id] = (itemCounts[item.location_id] || 0) + 1
        }
      })

      return (data || []).map((loc) => ({
        ...loc,
        item_count: itemCounts[loc.id] || 0,
      }))
    },
    enabled: !!userId,
  })

  const buildTree = (locs: StorageLocation[], parentId: string | null = null): StorageLocation[] => {
    return locs
      .filter((l) => l.parent_id === parentId)
      .map((l) => ({
        ...l,
        children: buildTree(locs, l.id),
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  const tree = buildTree(locations || [])

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const openCreateDialog = (parentId: string | null = null) => {
    setEditingLocation(null)
    setFormData({ name: '', description: '', type: 'shelf', parent_id: parentId })
    setDialogOpen(true)
  }

  const openEditDialog = (location: StorageLocation) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      description: location.description,
      type: location.type,
      parent_id: location.parent_id,
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      if (!userId) throw new Error('Not authenticated')

      if (editingLocation) {
        const { error } = await supabase
          .from('storage_locations')
          .update({
            name: data.name,
            description: data.description,
            type: data.type,
            parent_id: data.parent_id,
          })
          .eq('id', editingLocation.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('storage_locations').insert({
          user_id: userId,
          name: data.name,
          description: data.description,
          type: data.type,
          parent_id: data.parent_id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast({ title: editingLocation ? 'Lagerort aktualisiert' : 'Lagerort erstellt' })
      setDialogOpen(false)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('storage_locations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast({ title: 'Lagerort gelöscht' })
      setDeleteId(null)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const getTypeIcon = (type: location_type) => {
    const typeConfig = LOCATION_TYPES.find((t) => t.value === type)
    return typeConfig?.label || type
  }

  const renderLocation = (location: StorageLocation, level = 0) => {
    const hasChildren = location.children && location.children.length > 0
    const isExpanded = expandedIds.has(location.id)

    return (
      <div key={location.id}>
        <div
          className={cn(
            'flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent group',
            level > 0 && 'ml-6'
          )}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(location.id)}
                className="p-1 hover:bg-accent rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{location.name}</span>
            <Badge variant="secondary" className="text-xs">
              {getTypeIcon(location.type)}
            </Badge>
            {location.item_count !== undefined && location.item_count > 0 && (
              <Badge variant="outline" className="text-xs">
                {location.item_count} Artikel
              </Badge>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {level < 2 && (
                  <DropdownMenuItem onClick={() => openCreateDialog(location.id)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Unterort
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => openEditDialog(location)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => setDeleteId(location.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {location.children!.map((child) => renderLocation(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lagerorte</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Lagerorte und Lagerplätze
          </p>
        </div>
        <Button onClick={() => openCreateDialog(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Lagerort
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laden...
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-8">
              <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Keine Lagerorte</h3>
              <p className="text-muted-foreground mb-4">
                Erstellen Sie Ihren ersten Lagerort
              </p>
              <Button onClick={() => openCreateDialog(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Neuer Lagerort
              </Button>
            </div>
          ) : (
            <div className="space-y-1">{tree.map((loc) => renderLocation(loc))}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Lagerort bearbeiten' : 'Neuer Lagerort'}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? 'Bearbeiten Sie die Lagerortdetails'
                : 'Erstellen Sie einen neuen Lagerort'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Regal A1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Typ</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as location_type })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optionale Beschreibung..."
                rows={3}
              />
            </div>
            {formData.parent_id && (
              <div className="space-y-2">
                <Label>Übergeordneter Lagerort</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <span>
                    {locations?.find((l) => l.id === formData.parent_id)?.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto"
                    onClick={() => setFormData({ ...formData, parent_id: null })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lagerort löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Bereits zugeordnete
              Artikel werden nicht gelöscht.
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
