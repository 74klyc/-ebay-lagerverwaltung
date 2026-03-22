import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft, Save } from 'lucide-react'
import { Link } from 'react-router-dom'

const inventoryFormSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().optional(),
  sku: z.string().optional(),
  ean: z.string().optional(),
  category_id: z.string().optional().nullable(),
  location_id: z.string().optional().nullable(),
  quantity: z.number().int().min(0),
  condition: z.enum(['new', 'like_new', 'good', 'acceptable', 'parts']),
  status: z.enum(['in_stock', 'listed', 'sold', 'reserved', 'returned']),
  purchase_price: z.number().min(0),
  purchase_date: z.string().optional().nullable(),
  purchase_source: z.string().optional(),
  target_price: z.number().min(0).optional(),
  weight_grams: z.number().int().min(0).optional(),
  dimensions_length_cm: z.number().min(0).optional(),
  dimensions_width_cm: z.number().min(0).optional(),
  dimensions_height_cm: z.number().min(0).optional(),
  notes: z.string().optional(),
})

type InventoryFormData = z.infer<typeof inventoryFormSchema>

const ITEM_CONDITION_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'like_new', label: 'Wie Neu' },
  { value: 'good', label: 'Gut' },
  { value: 'acceptable', label: 'Akzeptabel' },
  { value: 'parts', label: 'Defekt/Ersatzteile' },
]

const ITEM_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'Auf Lager' },
  { value: 'listed', label: 'Gelistet' },
  { value: 'sold', label: 'Verkauft' },
  { value: 'reserved', label: 'Reserviert' },
  { value: 'returned', label: 'Retoure' },
]

export function InventoryFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()
  const isEditing = !!id

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<InventoryFormData>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      quantity: 1,
      condition: 'good',
      status: 'in_stock',
      purchase_price: 0,
      target_price: 0,
    },
  })

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['inventory', id],
    queryFn: async () => {
      if (!id) throw new Error('No ID')
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .eq('user_id', userId)
        .order('name')
      return data || []
    },
    enabled: !!userId,
  })

  const { data: locations } = useQuery({
    queryKey: ['locations', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data } = await supabase
        .from('storage_locations')
        .select('id, name, type')
        .eq('user_id', userId)
        .order('name')
      return data || []
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (item) {
      reset({
        title: item.title,
        description: item.description || '',
        sku: item.sku || '',
        ean: item.ean || '',
        category_id: item.category_id || null,
        location_id: item.location_id || null,
        quantity: item.quantity,
        condition: item.condition,
        status: item.status,
        purchase_price: item.purchase_price,
        purchase_date: item.purchase_date || null,
        purchase_source: item.purchase_source || '',
        target_price: item.target_price || 0,
        weight_grams: item.weight_grams || 0,
        dimensions_length_cm: item.dimensions_length_cm || 0,
        dimensions_width_cm: item.dimensions_width_cm || 0,
        dimensions_height_cm: item.dimensions_height_cm || 0,
        notes: item.notes || '',
      })
    }
  }, [item, reset])

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!userId) throw new Error('Not authenticated')

      const payload = {
        ...data,
        user_id: userId,
        purchase_date: data.purchase_date || null,
        purchase_price: Number(data.purchase_price) || 0,
        target_price: Number(data.target_price) || 0,
        weight_grams: Number(data.weight_grams) || 0,
        dimensions_length_cm: Number(data.dimensions_length_cm) || 0,
        dimensions_width_cm: Number(data.dimensions_width_cm) || 0,
        dimensions_height_cm: Number(data.dimensions_height_cm) || 0,
        images: [],
        tags: [],
      }

      if (isEditing && id) {
        const { error } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast({
        title: isEditing ? 'Artikel aktualisiert' : 'Artikel erstellt',
      })
      navigate('/inventory')
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Ein Fehler ist aufgetreten',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: any) => {
    mutation.mutate(data)
  }

  if (isEditing && itemLoading) {
    return <div className="flex justify-center p-8">Laden...</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/inventory">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Artikel bearbeiten' : 'Neuen Artikel anlegen'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Grunddaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Titel <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="z.B. iPhone 13 Pro 256GB"
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  placeholder="Detaillierte Beschreibung..."
                  rows={4}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" placeholder="Artikelnummer" {...register('sku')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ean">EAN</Label>
                  <Input id="ean" placeholder="Barcode" {...register('ean')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Einkaufspreis (€)</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    {...register('purchase_price', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_price">Zielpreis (€)</Label>
                  <Input
                    id="target_price"
                    type="number"
                    step="0.01"
                    {...register('target_price', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Menge</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    {...register('quantity', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Zustand</Label>
                  <Select
                    value={watch('condition')}
                    onValueChange={(v) => setValue('condition', v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_CONDITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Einkaufsdatum</Label>
                  <Input id="purchase_date" type="date" {...register('purchase_date')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_source">Herkunft</Label>
                  <Input
                    id="purchase_source"
                    placeholder="z.B. eBay Kleinanzeigen"
                    {...register('purchase_source')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zuordnung & Maße</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category_id">Kategorie</Label>
                <Select
                  value={watch('category_id') || 'none'}
                  onValueChange={(v) => setValue('category_id', v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Kategorie</SelectItem>
                    {categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_id">Lagerort</Label>
                <Select
                  value={watch('location_id') || 'none'}
                  onValueChange={(v) => setValue('location_id', v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lagerort wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Lagerort</SelectItem>
                    {locations?.map((loc: any) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(v) => setValue('status', v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_grams">Gewicht (g)</Label>
                <Input
                  id="weight_grams"
                  type="number"
                  min="0"
                  {...register('weight_grams', { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label>Maße (L × B × H in cm)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Länge"
                    {...register('dimensions_length_cm', { valueAsNumber: true })}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Breite"
                    {...register('dimensions_width_cm', { valueAsNumber: true })}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Höhe"
                    {...register('dimensions_height_cm', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notizen</Label>
                <Textarea
                  id="notes"
                  placeholder="Zusätzliche Informationen..."
                  rows={3}
                  {...register('notes')}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" type="button" asChild>
            <Link to="/inventory">Abbrechen</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>
      </form>
    </div>
  )
}
