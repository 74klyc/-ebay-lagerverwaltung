import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Info } from 'lucide-react'

interface Profile {
  tax_type: 'kleinunternehmer' | 'regelbesteuert'
}

interface MonthlyVat {
  month: string
  revenue: number
  vat19: number
  vat7: number
  count: number
}

export function VatPage() {
  const { user } = useAuth()
  const userId = user?.id
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('profiles')
        .select('tax_type')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  const { data: monthlyData } = useQuery<MonthlyVat[]>({
    queryKey: ['tax', 'vat', userId, year],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data } = await supabase
        .from('v_monthly_summary')
        .select('month, gross_revenue, sales_count')
        .eq('user_id', userId)
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-31`)
        .order('month', { ascending: true })

      return (data || []).map((d: any) => ({
        month: new Date(d.month).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
        revenue: d.gross_revenue || 0,
        vat19: Math.round((d.gross_revenue || 0) * 19 / 119 * 100) / 100,
        vat7: Math.round((d.gross_revenue || 0) * 7 / 107 * 100) / 100,
        count: d.sales_count || 0,
      }))
    },
    enabled: !!userId,
  })

  const isKleinunternehmer = profile?.tax_type === 'kleinunternehmer'

  const totals = monthlyData?.reduce((acc, m) => ({
    revenue: acc.revenue + m.revenue,
    vat19: acc.vat19 + m.vat19,
    vat7: acc.vat7 + m.vat7,
    count: acc.count + m.count,
  }), { revenue: 0, vat19: 0, vat7: 0, count: 0 })

  if (isKleinunternehmer) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Umsatzsteuer</h1>
          <p className="text-muted-foreground">
            Umsatzsteuer-Voranmeldung
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-2">Kleinunternehmerregelung aktiv</h3>
                <p className="text-sm text-muted-foreground">
                  Als Kleinunternehmer nach §19 UStG sind Sie von der Umsatzsteuer befreit.
                  Sie müssen keine USt-Voranmeldungen beim Finanzamt einreichen.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Ihre Umsätze werden ohne Umsatzsteuer ausgewiesen. Wenn Sie die 
                  Kleinunternehmergrenze von 22.000 € überschreiten, müssen Sie zur 
                  Regelbesteuerung wechseln.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ihre Umsätze {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-4xl font-bold mb-2">{formatCurrency(totals?.revenue || 0)}</p>
              <p className="text-muted-foreground">Gesamtumsatz (netto)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Umsatzsteuer</h1>
          <p className="text-muted-foreground">
            Übersicht für USt-Voranmeldungen (Regelbesteuerung)
          </p>
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
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Info className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold mb-2">Regelbesteuerung aktiv</h3>
              <p className="text-sm text-muted-foreground">
                Sie sind umsatzsteuerpflichtig und müssen regelmäßig USt-Voranmeldungen 
                beim Finanzamt einreichen. Die folgende Übersicht hilft Ihnen bei der 
                Berechnung der Umsatzsteuer.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gesamtumsatz (netto)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals?.revenue || 0)}</div>
            <p className="text-xs text-muted-foreground">{totals?.count || 0} Verkäufe</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">19% USt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals?.vat19 || 0)}</div>
            <p className="text-xs text-muted-foreground">Zu zahlen ans Finanzamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">7% USt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals?.vat7 || 0)}</div>
            <p className="text-xs text-muted-foreground">Zu zahlen ans Finanzamt</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monatliche Aufschlüsselung {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Monat</th>
                  <th className="text-right py-3 px-4 font-medium">Umsatz (netto)</th>
                  <th className="text-right py-3 px-4 font-medium">19% USt</th>
                  <th className="text-right py-3 px-4 font-medium">7% USt</th>
                  <th className="text-right py-3 px-4 font-medium">Verkäufe</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData?.map((month) => (
                  <tr key={month.month} className="border-b">
                    <td className="py-3 px-4">{month.month}</td>
                    <td className="text-right py-3 px-4">{formatCurrency(month.revenue)}</td>
                    <td className="text-right py-3 px-4 text-red-600">{formatCurrency(month.vat19)}</td>
                    <td className="text-right py-3 px-4 text-red-600">{formatCurrency(month.vat7)}</td>
                    <td className="text-right py-3 px-4 text-muted-foreground">{month.count}</td>
                  </tr>
                ))}
                <tr className="bg-muted font-semibold">
                  <td className="py-3 px-4">Gesamt</td>
                  <td className="text-right py-3 px-4">{formatCurrency(totals?.revenue || 0)}</td>
                  <td className="text-right py-3 px-4 text-red-600">{formatCurrency(totals?.vat19 || 0)}</td>
                  <td className="text-right py-3 px-4 text-red-600">{formatCurrency(totals?.vat7 || 0)}</td>
                  <td className="text-right py-3 px-4">{totals?.count || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hinweis zur Berechnung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Die Umsatzsteuer wird nach folgender Formel berechnet:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>19% Ware: USt = Brutto × 19 / 119</li>
            <li>7% Ware: USt = Brutto × 7 / 107</li>
          </ul>
          <p className="mt-4">
            <strong>Wichtig:</strong> Diese Berechnung ist eine Schätzung basierend auf 
            Ihren Verkaufsdaten. Für die genaue USt-Voranmeldung sollten Sie die 
            tatsächlichen Rechnungsbeträge und eventuelle Vorsteuer berücksichtigen. 
            Konsultieren Sie im Zweifel Ihren Steuerberater.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
