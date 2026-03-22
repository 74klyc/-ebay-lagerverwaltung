import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Package,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  MoreHorizontal,
  FolderOpen,
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

interface Category {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  color: string
  icon: string
  sort_order: number
  created_at: string
  updated_at: string
  item_count?: number
  children?: Category[]
}

interface CategoryFormData {
  name: string
  color: string
  icon: string
  parent_id: string | null
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6b7280',
]

export function CategoriesPage() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    color: '#6366f1',
    icon: 'Package',
    parent_id: null,
  })

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['categories', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

      if (error) throw error

      const { data: items } = await supabase
        .from('inventory_items')
        .select('category_id')
        .eq('user_id', userId)

      const itemCounts: Record<string, number> = {}
      items?.forEach((item) => {
        if (item.category_id) {
          itemCounts[item.category_id] = (itemCounts[item.category_id] || 0) + 1
        }
      })

      return (data || []).map((cat) => ({
        ...cat,
        item_count: itemCounts[cat.id] || 0,
      }))
    },
    enabled: !!userId,
  })

  const buildTree = (cats: Category[], parentId: string | null = null): Category[] => {
    return cats
      .filter((c) => c.parent_id === parentId)
      .map((c) => ({
        ...c,
        children: buildTree(cats, c.id),
      }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  const tree = buildTree(categories || [])

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
    setEditingCategory(null)
    setFormData({ name: '', color: '#6366f1', icon: 'Package', parent_id: parentId })
    setDialogOpen(true)
  }

  const openEditDialog = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      color: category.color,
      icon: category.icon,
      parent_id: category.parent_id,
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (!userId) throw new Error('Not authenticated')

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: data.name,
            color: data.color,
            icon: data.icon,
            parent_id: data.parent_id,
          })
          .eq('id', editingCategory.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert({
          user_id: userId,
          name: data.name,
          color: data.color,
          icon: data.icon,
          parent_id: data.parent_id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast({ title: editingCategory ? 'Kategorie aktualisiert' : 'Kategorie erstellt' })
      setDialogOpen(false)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast({ title: 'Kategorie gelöscht' })
      setDeleteId(null)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const renderCategory = (category: Category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0
    const isExpanded = expandedIds.has(category.id)

    return (
      <div key={category.id}>
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
                onClick={() => toggleExpand(category.id)}
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
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="font-medium">{category.name}</span>
            <Badge variant="secondary" className="text-xs">
              {category.item_count || 0}
            </Badge>
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
                  <DropdownMenuItem onClick={() => openCreateDialog(category.id)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Unterkategorie
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => openEditDialog(category)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => setDeleteId(category.id)}
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
            {category.children!.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kategorien</h1>
          <p className="text-muted-foreground">
            Organisieren Sie Ihre Artikel in Kategorien
          </p>
        </div>
        <Button onClick={() => openCreateDialog(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Kategorie
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
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Keine Kategorien</h3>
              <p className="text-muted-foreground mb-4">
                Erstellen Sie Ihre erste Kategorie
              </p>
              <Button onClick={() => openCreateDialog(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Neue Kategorie
              </Button>
            </div>
          ) : (
            <div className="space-y-1">{tree.map((cat) => renderCategory(cat))}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Bearbeiten Sie die Kategoriedetails'
                : 'Erstellen Sie eine neue Kategorie'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Elektronik"
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      formData.color === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            {formData.parent_id && (
              <div className="space-y-2">
                <Label>Elternkategorie</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <span>
                    {categories?.find((c) => c.id === formData.parent_id)?.name}
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
            <DialogTitle>Kategorie löschen?</DialogTitle>
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
