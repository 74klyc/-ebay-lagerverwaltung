export function calculateEbayFees(salePrice: number, feePercent: number = 13): number {
  return Math.round((salePrice * feePercent / 100) * 100) / 100
}

export function calculateNetProfit(params: {
  salePrice: number
  purchasePrice: number
  ebayFeePercent: number
  shippingCostActual: number
  packagingCost: number
  paymentFees: number
  otherCosts: number
  shippingIncome: number
}): number {
  const ebayFees = calculateEbayFees(params.salePrice, params.ebayFeePercent)
  return (
    params.salePrice + params.shippingIncome
    - params.purchasePrice
    - ebayFees
    - params.shippingCostActual
    - params.packagingCost
    - params.paymentFees
    - params.otherCosts
  )
}

export function calculateROI(profit: number, purchasePrice: number): number {
  if (purchasePrice <= 0) return 0
  return Math.round((profit / purchasePrice) * 100 * 10) / 10
}
