export function formatCurrency(amount: number, locale = "de-DE", currency = "EUR"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount)
}

export function formatDate(date: string | Date, locale = "de-DE"): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date))
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}
