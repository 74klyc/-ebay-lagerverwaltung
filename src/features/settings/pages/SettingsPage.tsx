import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import { User, Euro, Download, Moon, Sun, Monitor, Upload } from 'lucide-react'
import type { tax_type } from '@/types/database'

export function SettingsPage() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const [displayName, setDisplayName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [taxType, setTaxType] = useState<tax_type>('kleinunternehmer')
  const [smallBusinessLimit, setSmallBusinessLimit] = useState('22000')
  const [defaultEbayFee, setDefaultEbayFee] = useState('13')
  const [defaultShippingCost, setDefaultShippingCost] = useState('4.99')
  const [theme, setTheme] = useState('system')

  useQuery({
    queryKey: ['profile-settings', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error

      setDisplayName(data.display_name || '')
      setTaxId(data.tax_id || '')
      setTaxType(data.tax_type || 'kleinunternehmer')
      setSmallBusinessLimit(data.small_business_limit?.toString() || '22000')
      setDefaultEbayFee(data.default_ebay_fee_percent?.toString() || '13')
      setDefaultShippingCost(data.default_shipping_cost?.toString() || '4.99')
      setTheme(data.theme || 'system')

      return data
    },
    enabled: !!userId,
  })

  const profileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!userId) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: data.displayName,
          tax_id: data.taxId,
          tax_type: data.taxType,
          small_business_limit: parseFloat(data.smallBusinessLimit),
          default_ebay_fee_percent: parseFloat(data.defaultEbayFee),
          default_shipping_cost: parseFloat(data.defaultShippingCost),
          theme: data.theme,
        })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-settings'] })
      toast({ title: 'Einstellungen gespeichert' })
    },
    onError: (error: any) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    },
  })

  const handleSave = () => {
    profileMutation.mutate({
      displayName,
      taxId,
      taxType,
      smallBusinessLimit,
      defaultEbayFee,
      defaultShippingCost,
      theme,
    })
  }

  const exportAllData = async () => {
    if (!userId) return

    toast({ title: 'Export wird erstellt...' })

    const [items, sales, expenses] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('user_id', userId),
      supabase.from('sales').select('*').eq('user_id', userId),
      supabase.from('expenses').select('*').eq('user_id', userId),
    ])

    const data = {
      exportDate: new Date().toISOString(),
      items: items.data || [],
      sales: sales.data || [],
      expenses: expenses.data || [],
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export-${new Date().toISOString().split('T')[0]}.json`
    a.click()

    toast({ title: 'Export abgeschlossen' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihr Profil und Ihre App-Einstellungen
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="tax">
            <Euro className="mr-2 h-4 w-4" />
            Steuern
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="mr-2 h-4 w-4" />
            Import/Export
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Sun className="mr-2 h-4 w-4" />
            Darstellung
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>
                Ihre persönlichen Daten und Kontodaten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  E-Mail-Adresse kann nicht geändert werden
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Anzeigename</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ihr Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ebayUsername">eBay-Benutzername</Label>
                <Input
                  id="ebayUsername"
                  placeholder="Ihr eBay-Name"
                  className="bg-muted"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  eBay-Username wird nur zur Anzeige verwendet
                </p>
              </div>
              <Separator />
              <Button onClick={handleSave} disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Speichern...' : 'Änderungen speichern'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle>Steuereinstellungen</CardTitle>
              <CardDescription>
                Einstellungen für die Steuerberechnung
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxId">Steuernummer</Label>
                <Input
                  id="taxId"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="123/456/789"
                />
              </div>

              <div className="space-y-2">
                <Label>Steuerstatus</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="taxType"
                      value="kleinunternehmer"
                      checked={taxType === 'kleinunternehmer'}
                      onChange={() => setTaxType('kleinunternehmer')}
                    />
                    <span>Kleinunternehmer (§19 UStG)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="taxType"
                      value="regelbesteuert"
                      checked={taxType === 'regelbesteuert'}
                      onChange={() => setTaxType('regelbesteuert')}
                    />
                    <span>Regelbesteuert</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smallBusinessLimit">Kleinunternehmer-Grenze (€)</Label>
                <Input
                  id="smallBusinessLimit"
                  type="number"
                  value={smallBusinessLimit}
                  onChange={(e) => setSmallBusinessLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Standard: 22.000 € pro Jahr
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultEbayFee">Standard eBay-Gebühr (%)</Label>
                  <Input
                    id="defaultEbayFee"
                    type="number"
                    step="0.1"
                    value={defaultEbayFee}
                    onChange={(e) => setDefaultEbayFee(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultShippingCost">Standard Versandkosten (€)</Label>
                  <Input
                    id="defaultShippingCost"
                    type="number"
                    step="0.01"
                    value={defaultShippingCost}
                    onChange={(e) => setDefaultShippingCost(e.target.value)}
                  />
                </div>
              </div>

              <Separator />
              <Button onClick={handleSave} disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Speichern...' : 'Änderungen speichern'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Import / Export</CardTitle>
              <CardDescription>
                Exportieren Sie Ihre Daten für Backups oder den Import in andere Systeme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Vollständiger Datenexport</h4>
                    <p className="text-sm text-muted-foreground">
                      Alle Ihre Artikel, Verkäufe und Ausgaben als JSON
                    </p>
                  </div>
                  <Button variant="outline" onClick={exportAllData}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportieren
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">CSV-Export</h4>
                    <p className="text-sm text-muted-foreground">
                      Exportieren Sie einzelne Tabellen als CSV
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Bald verfügbar
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">CSV-Import</h4>
                    <p className="text-sm text-muted-foreground">
                      Importieren Sie Artikel aus einer CSV-Datei
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    <Upload className="mr-2 h-4 w-4" />
                    Bald verfügbar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Darstellung</CardTitle>
              <CardDescription>
                Passen Sie das Aussehen der App an
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-2 p-4 border rounded-lg transition-colors ${
                      theme === 'light' ? 'border-primary bg-primary/10' : ''
                    }`}
                  >
                    <Sun className="h-5 w-5" />
                    <span>Hell</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-2 p-4 border rounded-lg transition-colors ${
                      theme === 'dark' ? 'border-primary bg-primary/10' : ''
                    }`}
                  >
                    <Moon className="h-5 w-5" />
                    <span>Dunkel</span>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`flex items-center gap-2 p-4 border rounded-lg transition-colors ${
                      theme === 'system' ? 'border-primary bg-primary/10' : ''
                    }`}
                  >
                    <Monitor className="h-5 w-5" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              <Separator />
              <Button onClick={handleSave} disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Speichern...' : 'Änderungen speichern'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
