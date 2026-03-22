import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, FileText, Printer } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface EuerData {
  year: number
  gross_income: number
  cost_of_goods: number
  platform_fees: number
  shipping_expenses: number
  other_expenses: number
  net_income: number
}

interface Profile {
  display_name: string
  tax_id: string
}

export function EuerPage() {
  const { user } = useAuth()
  const userId = user?.id
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const { data: euerData } = useQuery<EuerData>({
    queryKey: ['tax', 'euer', userId, year],
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
        gross_income: salesData?.gross_income || 0,
        cost_of_goods: salesData?.cost_of_goods || 0,
        platform_fees: salesData?.platform_fees || 0,
        shipping_expenses: salesData?.shipping_expenses || 0,
        other_expenses: expenses,
        net_income: (salesData?.net_income || 0) - expenses,
      }
    },
    enabled: !!userId,
  })

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, tax_id')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  const totalExpenses = (euerData?.cost_of_goods || 0) 
    + (euerData?.platform_fees || 0) 
    + (euerData?.shipping_expenses || 0) 
    + (euerData?.other_expenses || 0)

  const exportPDF = () => {
    if (!euerData || !profile) return

    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text('Einnahme-Überschuss-Rechnung', 14, 22)
    doc.setFontSize(12)
    doc.text(`Steuerjahr: ${euerData.year}`, 14, 35)
    doc.text(`Name: ${profile.display_name}`, 14, 43)
    if (profile.tax_id) {
      doc.text(`Steuernummer: ${profile.tax_id}`, 14, 51)
    }

    doc.setFontSize(14)
    doc.text('I. Betriebseinnahmen', 14, 65)
    
    autoTable(doc, {
      startY: 72,
      head: [['Position', 'Betrag']],
      body: [
        ['Verkaufserlöse (inkl. Versandkostenerstattungen)', `EUR ${euerData.gross_income.toFixed(2)}`],
        ['', ''],
        ['SUMME EINNAHMEN', `EUR ${euerData.gross_income.toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    })

    const table2Y = (doc as any).lastAutoTable.finalY + 15
    doc.text('II. Betriebsausgaben', 14, table2Y)
    
    autoTable(doc, {
      startY: table2Y + 7,
      head: [['Position', 'Betrag']],
      body: [
        ['Wareneinsatz (Einkauf der verkauften Waren)', `EUR ${euerData.cost_of_goods.toFixed(2)}`],
        ['eBay-/Zahlungsgebühren', `EUR ${euerData.platform_fees.toFixed(2)}`],
        ['Versandkosten (echte Versandkosten)', `EUR ${euerData.shipping_expenses.toFixed(2)}`],
        ['Sonstige Betriebsausgaben', `EUR ${euerData.other_expenses.toFixed(2)}`],
        ['', ''],
        ['SUMME AUSGABEN', `EUR ${totalExpenses.toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] },
    })

    const table3Y = (doc as any).lastAutoTable.finalY + 15
    doc.setFontSize(14)
    doc.text('III. Gewinn/Verlust', 14, table3Y)
    
    autoTable(doc, {
      startY: table3Y + 7,
      body: [
        [`GEWINN: EUR ${euerData.net_income.toFixed(2)}`],
      ],
      theme: 'grid',
      styles: { fontSize: 14, fontStyle: 'bold' },
    })

    doc.save(`EÜR_${euerData.year}.pdf`)
  }

  const exportCSV = () => {
    if (!euerData) return

    const rows = [
      ['EINNAHME-ÜBERSCHUSS-RECHNUNG', euerData.year],
      [''],
      ['I. BETRIEBSEINNAHMEN', ''],
      ['Verkaufserlöse (inkl. Versandkostenerstattungen)', euerData.gross_income.toFixed(2)],
      ['SUMME EINNAHMEN', euerData.gross_income.toFixed(2)],
      [''],
      ['II. BETRIEBSAUSGABEN', ''],
      ['Wareneinsatz', euerData.cost_of_goods.toFixed(2)],
      ['eBay-/Zahlungsgebühren', euerData.platform_fees.toFixed(2)],
      ['Versandkosten', euerData.shipping_expenses.toFixed(2)],
      ['Sonstige Betriebsausgaben', euerData.other_expenses.toFixed(2)],
      ['SUMME AUSGABEN', totalExpenses.toFixed(2)],
      [''],
      ['III. ERGEBNIS', ''],
      ['Gewinn', euerData.net_income.toFixed(2)],
    ]

    const csv = rows.map((row) => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `EÜR_${euerData.year}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Einnahme-Überschuss-Rechnung</h1>
          <p className="text-muted-foreground">
            Offizielle EÜR nach deutschem Steuerrecht
          </p>
        </div>
        <div className="flex gap-2">
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
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Jahresabschluss {year}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button onClick={exportPDF}>
              <FileText className="mr-2 h-4 w-4" />
              PDF erstellen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">I. Betriebseinnahmen</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">Verkaufserlöse (inkl. Versandkostenerstattungen)</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(euerData?.gross_income || 0)}</td>
                  </tr>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="p-3">SUMME EINNAHMEN</td>
                    <td className="p-3 text-right">{formatCurrency(euerData?.gross_income || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">II. Betriebsausgaben</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">Wareneinsatz (Einkauf der verkauften Waren)</td>
                    <td className="p-3 text-right text-red-600">-{formatCurrency(euerData?.cost_of_goods || 0)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">eBay-/Zahlungsgebühren</td>
                    <td className="p-3 text-right text-red-600">-{formatCurrency(euerData?.platform_fees || 0)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Versandkosten (echte Versandkosten)</td>
                    <td className="p-3 text-right text-red-600">-{formatCurrency(euerData?.shipping_expenses || 0)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Sonstige Betriebsausgaben</td>
                    <td className="p-3 text-right text-red-600">-{formatCurrency(euerData?.other_expenses || 0)}</td>
                  </tr>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="p-3">SUMME AUSGABEN</td>
                    <td className="p-3 text-right">-{formatCurrency(totalExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">III. Ergebnis</h3>
            <div className="border-2 border-primary rounded-lg overflow-hidden bg-primary/5">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="p-4 text-xl font-bold">
                      GEWINN: {formatCurrency(euerData?.net_income || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
