import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Plus, Search, Download, Receipt, Trash2, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import type { expense_category } from '@/types/database'

const EXPENSE_CATEGORIES: { value: expense_category; label: string }[] = [
  { value: 'shipping_materials', label: 'Versandmaterial' },
  { value: 'tools', label: 'Werkzeug' },
  { value: 'software', label: 'Software' },
  { value: 'ebay_store_fees', label: 'eBay-Shop Gebühren' },
  { value: 'office_supplies', label: 'Bürobedarf' },
  { value: 'travel', label: 'Fahrtkosten' },
  { value: 'packaging', label: 'Verpackungsmaterial' },
  { value: 'other', label: 'Sonstiges' },
]

interface Expense {
  id: string
  user_id: string
  category: expense_category
  description: string
  amount: number
  date: string
  receipt_url: string
  is_tax_deductible: boolean
  notes: string
  created_at: string
  updated_at: string
}

interface ExpenseFormData {
  category: expense_category
  description: string
  amount: number
  date: string
  is_tax_deductible: boolean
  notes: string
}

export function ExpensesPage() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ExpenseFormData>({
    category: 'other',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    is_tax_deductible: true,
    notes: '',
  })

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', userId, categoryFilter],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      let query = supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (categoryFilter && categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter)
      }

      const { data, error } = await query.limit(100)
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
  })

  const filteredExpenses = expenses?.filter((expense) => {
    if (search) {
      const desc = expense.description?.toLowerCase() || ''
      if (!desc.includes(search.toLowerCase())) return false
    }
    return true
  })

  const totals = {
    total: filteredExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0,
    deductible: filteredExpenses?.filter((e) => e.is_tax_deductible).reduce((sum, e) => sum + e.amount, 0) || 0,
    count: filteredExpenses?.length || 0,
  }

  const byCategory = EXPENSE_CATEGORIES.map((cat) => ({
    ...cat,
    total: expenses?.filter((e) => e.category === cat.value).reduce((sum, e) => sum + e.amount, 0) || 0,
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total)

  const openCreateDialog = () => {
    setEditingExpense(null)
    setFormData({
      category: 'other',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      is_tax_deductible: true,
      notes: '',
    })
    setDialogOpen(true)
  }

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      is_tax_deductible: expense.is_tax_deductible,
      notes: expense.notes || '',
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      if (!userId) throw new Error('Not authenticated')

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            category: data.category,
            description: data.description,
            amount: data.amount,
            date: data.date,
            is_tax_deductible: data.is_tax_deductible,
            notes: data.notes,
          })
          .eq('id', editingExpense.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('expenses').insert({
          user_id: userId,
          category: data.category,
          description: data.description,
          amount: data.amount,
          date: data.date,
          is_tax_deductible: data.is_tax_deductible,
          notes: data.notes,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast({ title: editingExpense ? 'Ausgabe aktualisiert' : 'Ausgabe erfasst' })
      setDialogOpen(false)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast({ title: 'Ausgabe gelöscht' })
      setDeleteId(null)
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const exportCSV = () => {
    if (!filteredExpenses || filteredExpenses.length === 0) return

    const headers = ['Datum', 'Kategorie', 'Beschreibung', 'Betrag', 'Steuerlich absetzbar']
    const rows = filteredExpenses.map((e) => [
      formatDate(e.date),
      EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label || e.category,
      e.description,
      e.amount.toFixed(2),
      e.is_tax_deductible ? 'Ja' : 'Nein',
    ])

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ausgaben-${new Date().getFullYear()}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ausgaben</h1>
          <p className="text-muted-foreground">
            Erfassen und verwalten Sie Ihre Betriebsausgaben
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Ausgabe
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-muted-foreground">{totals.count} Ausgaben</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Steuerlich absetzbar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.deductible)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total > 0 ? ((totals.deductible / totals.total) * 100).toFixed(0) : 0}% der Gesamtausgaben
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byCategory.slice(0, 3).map((cat) => (
              <div key={cat.value} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{cat.label}</span>
                <span className="font-medium">{formatCurrency(cat.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nach Beschreibung suchen..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : filteredExpenses && filteredExpenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-center">Absetzbar</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell>
                      {EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label || expense.category}
                    </TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {expense.is_tax_deductible ? (
                        <span className="text-green-600">Ja</span>
                      ) : (
                        <span className="text-muted-foreground">Nein</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(expense)}>
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteId(expense.id)}
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
          ) : (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Keine Ausgaben gefunden</h3>
              <p className="text-muted-foreground mb-4">
                Erfassen Sie Ihre erste Ausgabe
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Neue Ausgabe
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? 'Bearbeiten Sie die Ausgabendetails'
                : 'Erfassen Sie eine neue Betriebsausgabe'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v as expense_category })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="z.B. Verpackungsmaterial"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Betrag (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tax_deductible"
                checked={formData.is_tax_deductible}
                onCheckedChange={(checked: boolean | 'indeterminate') => setFormData({ ...formData, is_tax_deductible: !!checked })}
              />
              <Label htmlFor="tax_deductible">Steuerlich absetzbar</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.description || !formData.amount || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ausgabe löschen?</DialogTitle>
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
