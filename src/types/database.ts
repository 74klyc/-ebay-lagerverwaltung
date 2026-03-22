export type tax_type = 'kleinunternehmer' | 'regelbesteuert'
export type item_condition = 'new' | 'like_new' | 'good' | 'acceptable' | 'parts'
export type item_status = 'in_stock' | 'listed' | 'sold' | 'reserved' | 'returned'
export type listing_platform = 'ebay_de' | 'ebay_com' | 'kleinanzeigen' | 'other'
export type listing_type = 'fixed_price' | 'auction'
export type listing_status = 'draft' | 'active' | 'ended' | 'sold' | 'cancelled'
export type sale_status = 'pending' | 'paid' | 'shipped' | 'delivered' | 'returned' | 'refunded'
export type location_type = 'shelf' | 'box' | 'room' | 'warehouse' | 'other'
export type expense_category = 'shipping_materials' | 'tools' | 'software' | 'ebay_store_fees' | 'office_supplies' | 'travel' | 'packaging' | 'other'

export interface Profile {
  id: string
  display_name: string
  ebay_username: string
  tax_id: string
  tax_type: tax_type
  small_business_limit: number
  default_shipping_cost: number
  default_ebay_fee_percent: number
  currency: string
  locale: string
  theme: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  color: string
  icon: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface StorageLocation {
  id: string
  user_id: string
  name: string
  description: string
  type: location_type
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface InventoryItem {
  id: string
  user_id: string
  title: string
  description: string
  sku: string
  ean: string
  category_id: string | null
  location_id: string | null
  quantity: number
  condition: item_condition
  status: item_status
  purchase_price: number
  purchase_date: string | null
  purchase_source: string
  target_price: number
  weight_grams: number
  dimensions_length_cm: number
  dimensions_width_cm: number
  dimensions_height_cm: number
  images: string[]
  tags: string[]
  notes: string
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  user_id: string
  item_id: string
  ebay_item_id: string
  platform: listing_platform
  listing_type: listing_type
  start_price: number
  buy_it_now_price: number
  current_bid: number
  shipping_cost: number
  watchers: number
  views: number
  ebay_fee_percent: number
  ebay_fees_calculated: number
  status: listing_status
  listed_at: string | null
  ends_at: string | null
  ebay_category: string
  notes: string
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  user_id: string
  item_id: string
  listing_id: string | null
  sale_price: number
  shipping_income: number
  purchase_price: number
  shipping_cost_actual: number
  ebay_fees: number
  payment_fees: number
  packaging_cost: number
  other_costs: number
  net_profit: number
  buyer_username: string
  buyer_note: string
  status: sale_status
  tracking_number: string
  carrier: string
  sold_at: string
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export interface Expense {
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
