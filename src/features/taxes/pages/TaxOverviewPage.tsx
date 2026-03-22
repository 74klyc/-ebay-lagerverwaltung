import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, FileText, Download, Euro } from 'lucide-react'
import { Link } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface TaxReport {
  year: number
  total_sales: number
  gross_income: number
  cost_of_goods: number
  platform_fees: number
  shipping_expenses: number
  other_expenses: number
  net_income: number
  vat_collected_19: number
  vat_collected_7: number
}

interface Profile {
  tax_type: 'kleinunternehmer' | 'regelbesteuert'
  small_business_limit: number
  display_name: string
  tax_id: string
}

export function TaxOverviewPage() {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('profiles')
        .select('tax_type, small_business_limit, display_name, tax_id')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  const { data: taxReport } = useQuery<TaxReport>({
    queryKey: ['tax', 'report', userId, year],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const { data: salesData } = await supabase
        .from('v_yearly_tax_report')
        .select('*')
        .eq('user_id', userId)
        .eq('year', parseInt(year))
        .single()

      const { data: expensesData } = await supabase
        .from('v_yearly_expenses')
        .select('total_amount')
        .eq('user_id', userId)
        .eq('year', parseInt(year))
        .eq('is_tax_deductible', true)

      const expenses = expensesData?.reduce((sum, e) => sum + e.total_amount, 0) || 0

      return {
        year: parseInt(year),
        total_sales: salesData?.total_sales || 0,
        gross_income: salesData?.gross_income || 0,
        cost_of_goods: salesData?.cost_of_goods || 0,
        platform_fees: salesData?.platform_fees || 0,
        shipping_expenses: salesData?.shipping_expenses || 0,
        other_expenses: expenses,
        net_income: (salesData?.net_income || 0) - expenses,
        vat_collected_19: salesData?.vat_collected_19 || 0,
        vat_collected_7: salesData?.vat_collected_7 || 0,
      }
    },
    enabled: !!userId,
  })

  const { data: currentYearSales } = useQuery({
    queryKey: ['tax', 'current-year-sales', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const currentYear = new Date().getFullYear()
      
      const { data } = await supabase
        .from('sales')
        .select('sale_price, shipping_income')
        .eq('user_id', userId)
        .gte('sold_at', `${currentYear}-01-01`)
        .not('status', 'in', '(returned,refunded)')

      return data?.reduce((sum, s) => sum + s.sale_price + s.shipping_income, 0) || 0
    },
    enabled: !!userId,
  })

  const isKleinunternehmer = profile?.tax_type === 'kleinunternehmer'
  const limit = profile?.small_business_limit || 22000
  const currentRevenue = currentYearSales || 0
  const limitUsage = Math.min((currentRevenue / limit) * 100, 100)
  const remaining = Math.max(limit - currentRevenue, 0)

  const exportPDF = () => {
    if (!taxReport || !profile) return

    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('Einnahme-Überschuss-Rechnung', 14, 22)
    doc.setFontSize(11)
    doc.text(`Steuerjahr: ${taxReport.year}`, 14, 32)
    doc.text(`Name: ${profile.display_name}`, 14, 38)
    if (profile.tax_id) {
      doc.text(`Steuernummer: ${profile.tax_id}`, 14, 44)
    }

    autoTable(doc, {
      startY: 52,
      head: [['Position', 'Betrag (EUR)']],
      body: [
        ['Verkaufserlöse', taxReport.gross_income.toFixed(2)],
        ['SUMME EINNAHMEN', taxReport.gross_income.toFixed(2)],
      ],
      theme: 'grid',
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    autoTable(doc, {
      startY: finalY,
      head: [['Position', 'Betrag (EUR)']],
      body: [
        ['Wareneinsatz', `-${taxReport.cost_of_goods.toFixed(2)}`],
        ['eBay-/Zahlungsgebühren', `-${taxReport.platform_fees.toFixed(2)}`],
        ['Versandkosten', `-${taxReport.shipping_expenses.toFixed(2)}`],
        ['Sonstige Betriebsausgaben', `-${taxReport.other_expenses.toFixed(2)}`],
        ['SUMME AUSGABEN', `-${(taxReport.cost_of_goods + taxReport.platform_fees + taxReport.shipping_expenses + taxReport.other_expenses).toFixed(2)}`],
      ],
      theme: 'grid',
    })

    const finalY2 = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(14)
    doc.text('III. Ergebnis', 14, finalY2)
    doc.setFontSize(16)
    doc.text(`GEWINN: ${taxReport.net_income.toFixed(2)} EUR`, 14, finalY2 + 10)

    doc.save(`EÜR_${taxReport.year}.pdf`)
  }

  const exportCSV = () => {
    if (!taxReport) return

    const rows = [
      ['Einnahme-Überschuss-Rechnung', taxReport.year],
      [''],
      ['EINNAHMEN', ''],
      ['Verkaufserlöse', taxReport.gross_income.toFixed(2)],
      ['', ''],
      ['AUSGABEN', ''],
      ['Wareneinsatz', taxReport.cost_of_goods.toFixed(2)],
      ['eBay-/Zahlungsgebühren', taxReport.platform_fees.toFixed(2)],
      ['Versandkosten', taxReport.shipping_expenses.toFixed(2)],
      ['Sonstige Betriebsausgaben', taxReport.other_expenses.toFixed(2)],
      ['', ''],
      ['ERGEBNIS', ''],
      ['Gewinn', taxReport.net_income.toFixed(2)],
    ]

    const csv = rows.map((row) => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `EÜR_${taxReport.year}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Steuern</h1>
          <p className="text-muted-foreground">
            Übersicht über Ihre Steuerdaten
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

      {isKleinunternehmer && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Kleinunternehmer-Status</h3>
                  <Badge variant="warning">aktiv</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Ihr Umsatz {new Date().getFullYear()}: {formatCurrency(currentRevenue)} von {formatCurrency(limit)}
                </p>
                <Progress value={limitUsage} className="h-3 mb-2" />
                <p className="text-sm">
                  <span className="font-medium">{formatCurrency(remaining)}</span> verbleibend bis zur Grenze
                  ({limitUsage.toFixed(1)}% ausgeschöpft)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Einnahmen (Brutto)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(taxReport?.gross_income || 0)}</div>
            <p className="text-xs text-muted-foreground">{taxReport?.total_sales || 0} Verkäufe</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ausgaben</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatCurrency((taxReport?.cost_of_goods || 0) + (taxReport?.platform_fees || 0) + (taxReport?.shipping_expenses || 0) + (taxReport?.other_expenses || 0))}
            </div>
            <p className="text-xs text-muted-foreground">Gesamtkosten</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gewinn vor Steuern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-2xl font-bold',
              (taxReport?.net_income || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {formatCurrency(taxReport?.net_income || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isKleinunternehmer ? 'Ohne USt' : 'Inkl. USt-Voranmeldung'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <Euro className="h-4 w-4 inline mr-1" />
              {isKleinunternehmer ? 'Umsatzsteuer' : 'USt-Voranmeldung'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {isKleinunternehmer ? '0,00' : formatCurrency((taxReport?.vat_collected_19 || 0) + (taxReport?.vat_collected_7 || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {isKleinunternehmer ? 'Nicht umsatzsteuerpflichtig' : '19% + 7%'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Jahresübersicht {year}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/taxes/euer')}>
              <FileText className="mr-2 h-4 w-4" />
              Details
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Einnahmen</span>
              <span className="font-medium">{formatCurrency(taxReport?.gross_income || 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Wareneinsatz</span>
              <span className="font-medium text-red-600">-{formatCurrency(taxReport?.cost_of_goods || 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Gebühren</span>
              <span className="font-medium text-red-600">-{formatCurrency(taxReport?.platform_fees || 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Versandkosten</span>
              <span className="font-medium text-red-600">-{formatCurrency(taxReport?.shipping_expenses || 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Betriebsausgaben</span>
              <span className="font-medium text-red-600">-{formatCurrency(taxReport?.other_expenses || 0)}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold text-lg">
              <span>Gewinn</span>
              <span className={cn((taxReport?.net_income || 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
                {formatCurrency(taxReport?.net_income || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exportieren Sie Ihre Steuerdaten für die Buchhaltung oder den Steuerberater.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={exportPDF} className="w-full justify-start">
                <Download className="mr-2 h-4 w-4" />
                EÜR als PDF
              </Button>
              <Button variant="outline" onClick={exportCSV} className="w-full justify-start">
                <Download className="mr-2 h-4 w-4" />
                EÜR als CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
