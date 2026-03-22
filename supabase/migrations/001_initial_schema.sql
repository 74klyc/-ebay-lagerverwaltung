-- ============================================
-- eBay Lagerverwaltung - Supabase Migration
-- ============================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enum Types
CREATE TYPE tax_type AS ENUM ('kleinunternehmer', 'regelbesteuert');
CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'good', 'acceptable', 'parts');
CREATE TYPE item_status AS ENUM ('in_stock', 'listed', 'sold', 'reserved', 'returned');
CREATE TYPE listing_platform AS ENUM ('ebay_de', 'ebay_com', 'kleinanzeigen', 'other');
CREATE TYPE listing_type AS ENUM ('fixed_price', 'auction');
CREATE TYPE listing_status AS ENUM ('draft', 'active', 'ended', 'sold', 'cancelled');
CREATE TYPE sale_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'returned', 'refunded');
CREATE TYPE location_type AS ENUM ('shelf', 'box', 'room', 'warehouse', 'other');
CREATE TYPE expense_category AS ENUM ('shipping_materials', 'tools', 'software', 'ebay_store_fees', 'office_supplies', 'travel', 'packaging', 'other');

-- 3. Helper Function: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  ebay_username TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  tax_type tax_type NOT NULL DEFAULT 'kleinunternehmer',
  small_business_limit DECIMAL(10,2) DEFAULT 22000.00,
  default_shipping_cost DECIMAL(10,2) DEFAULT 4.99,
  default_ebay_fee_percent DECIMAL(5,2) DEFAULT 13.00,
  currency TEXT DEFAULT 'EUR',
  locale TEXT DEFAULT 'de-DE',
  theme TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'Package',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, name, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Storage Locations Table
CREATE TABLE IF NOT EXISTS storage_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type location_type NOT NULL DEFAULT 'shelf',
  parent_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, name, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_locations_user ON storage_locations(user_id);
CREATE TRIGGER locations_updated_at BEFORE UPDATE ON storage_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Inventory Items Table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Stammdaten
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  sku TEXT,
  ean TEXT DEFAULT '',

  -- Zuordnungen
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,

  -- Bestand & Zustand
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition item_condition NOT NULL DEFAULT 'good',
  status item_status NOT NULL DEFAULT 'in_stock',

  -- Preise
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  purchase_date DATE,
  purchase_source TEXT DEFAULT '',
  target_price DECIMAL(10,2) DEFAULT 0.00,

  -- Physisch
  weight_grams INTEGER DEFAULT 0,
  dimensions_length_cm DECIMAL(6,2) DEFAULT 0,
  dimensions_width_cm DECIMAL(6,2) DEFAULT 0,
  dimensions_height_cm DECIMAL(6,2) DEFAULT 0,

  -- Medien & Meta
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_items_user ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON inventory_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_location ON inventory_items(location_id);
CREATE INDEX IF NOT EXISTS idx_items_search ON inventory_items USING GIN (to_tsvector('german', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(sku, '')));
CREATE TRIGGER items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. Listings Table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- eBay-Daten
  ebay_item_id TEXT DEFAULT '',
  platform listing_platform NOT NULL DEFAULT 'ebay_de',
  listing_type listing_type NOT NULL DEFAULT 'fixed_price',

  -- Preise
  start_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  buy_it_now_price DECIMAL(10,2) DEFAULT 0.00,
  current_bid DECIMAL(10,2) DEFAULT 0.00,
  shipping_cost DECIMAL(10,2) DEFAULT 0.00,

  -- Statistiken
  watchers INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,

  -- Gebühren
  ebay_fee_percent DECIMAL(5,2) DEFAULT 13.00,
  ebay_fees_calculated DECIMAL(10,2) GENERATED ALWAYS AS (
    ROUND(start_price * ebay_fee_percent / 100, 2)
  ) STORED,

  -- Status & Zeitraum
  status listing_status NOT NULL DEFAULT 'draft',
  listed_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- eBay-Kategorie
  ebay_category TEXT DEFAULT '',

  -- Notizen
  notes TEXT DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_item ON listings(item_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(user_id, status);
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 9. Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,

  -- Einnahmen
  sale_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  shipping_income DECIMAL(10,2) DEFAULT 0.00,

  -- Kosten
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  shipping_cost_actual DECIMAL(10,2) DEFAULT 0.00,
  ebay_fees DECIMAL(10,2) DEFAULT 0.00,
  payment_fees DECIMAL(10,2) DEFAULT 0.00,
  packaging_cost DECIMAL(10,2) DEFAULT 0.00,
  other_costs DECIMAL(10,2) DEFAULT 0.00,

  -- Berechnet: Nettogewinn
  net_profit DECIMAL(10,2) GENERATED ALWAYS AS (
    sale_price + shipping_income
    - purchase_price - shipping_cost_actual
    - ebay_fees - payment_fees
    - packaging_cost - other_costs
  ) STORED,

  -- Käufer
  buyer_username TEXT DEFAULT '',
  buyer_note TEXT DEFAULT '',

  -- Status & Tracking
  status sale_status NOT NULL DEFAULT 'pending',
  tracking_number TEXT DEFAULT '',
  carrier TEXT DEFAULT '',

  -- Timestamps
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_item ON sales(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(user_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(user_id, status);
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: Bei Verkauf → Artikel-Status setzen & Quantity reduzieren
CREATE OR REPLACE FUNCTION handle_sale_created()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET status = 'sold',
      quantity = GREATEST(quantity - 1, 0)
  WHERE id = NEW.item_id;

  IF NEW.listing_id IS NOT NULL THEN
    UPDATE listings SET status = 'sold' WHERE id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_sale_created ON sales;
CREATE TRIGGER on_sale_created
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION handle_sale_created();

-- 10. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  category expense_category NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT DEFAULT '',
  is_tax_deductible BOOLEAN DEFAULT true,
  notes TEXT DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(user_id, date);
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Views for Reports
-- ============================================

-- View: Täglicher Umsatz & Gewinn
CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
  user_id,
  DATE(sold_at) AS day,
  COUNT(*) AS sales_count,
  SUM(sale_price + shipping_income) AS total_revenue,
  SUM(net_profit) AS total_profit,
  AVG(net_profit) AS avg_profit_per_sale
FROM sales
WHERE status NOT IN ('returned', 'refunded')
GROUP BY user_id, DATE(sold_at);

-- View: Monatliche Zusammenfassung
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT
  s.user_id,
  DATE_TRUNC('month', s.sold_at) AS month,
  COUNT(*) AS sales_count,
  SUM(s.sale_price + s.shipping_income) AS gross_revenue,
  SUM(s.purchase_price) AS total_purchase_costs,
  SUM(s.ebay_fees + s.payment_fees) AS total_fees,
  SUM(s.shipping_cost_actual + s.packaging_cost) AS total_shipping_costs,
  SUM(s.other_costs) AS total_other_costs,
  SUM(s.net_profit) AS net_profit,
  CASE
    WHEN SUM(s.sale_price) > 0
    THEN ROUND(SUM(s.net_profit) / SUM(s.sale_price) * 100, 1)
    ELSE 0
  END AS profit_margin_percent
FROM sales s
WHERE s.status NOT IN ('returned', 'refunded')
GROUP BY s.user_id, DATE_TRUNC('month', s.sold_at);

-- View: Jahresübersicht für Steuererklärung
CREATE OR REPLACE VIEW v_yearly_tax_report AS
SELECT
  s.user_id,
  EXTRACT(YEAR FROM s.sold_at)::INTEGER AS year,
  COUNT(*) AS total_sales,
  SUM(s.sale_price + s.shipping_income) AS gross_income,
  SUM(s.purchase_price) AS cost_of_goods,
  SUM(s.ebay_fees + s.payment_fees) AS platform_fees,
  SUM(s.shipping_cost_actual + s.packaging_cost) AS shipping_expenses,
  SUM(s.other_costs) AS other_expenses,
  SUM(s.net_profit) AS net_income,
  ROUND(SUM(s.sale_price) * 19 / 119, 2) AS vat_collected_19,
  ROUND(SUM(s.sale_price) * 7 / 107, 2) AS vat_collected_7
FROM sales s
WHERE s.status NOT IN ('returned', 'refunded')
GROUP BY s.user_id, EXTRACT(YEAR FROM s.sold_at);

-- View: Gewinn pro Artikel
CREATE OR REPLACE VIEW v_item_profitability AS
SELECT
  s.id AS sale_id,
  s.user_id,
  i.title AS item_title,
  i.sku,
  i.category_id,
  c.name AS category_name,
  s.purchase_price,
  s.sale_price,
  s.ebay_fees,
  s.shipping_cost_actual,
  s.net_profit,
  CASE
    WHEN s.purchase_price > 0
    THEN ROUND((s.net_profit / s.purchase_price) * 100, 1)
    ELSE 0
  END AS roi_percent,
  s.sold_at
FROM sales s
JOIN inventory_items i ON s.item_id = i.id
LEFT JOIN categories c ON i.category_id = c.id
WHERE s.status NOT IN ('returned', 'refunded');

-- View: Lagerbestand-Bewertung
CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT
  user_id,
  COUNT(*) AS total_items,
  SUM(quantity) AS total_units,
  SUM(purchase_price * quantity) AS total_value_purchase,
  SUM(target_price * quantity) AS total_value_target,
  SUM(CASE WHEN status = 'in_stock' THEN quantity ELSE 0 END) AS units_in_stock,
  SUM(CASE WHEN status = 'listed' THEN quantity ELSE 0 END) AS units_listed,
  SUM(CASE WHEN status = 'sold' THEN quantity ELSE 0 END) AS units_sold
FROM inventory_items
GROUP BY user_id;

-- View: Ausgaben pro Jahr
CREATE OR REPLACE VIEW v_yearly_expenses AS
SELECT
  user_id,
  EXTRACT(YEAR FROM date)::INTEGER AS year,
  category,
  SUM(amount) AS total_amount,
  COUNT(*) AS expense_count,
  BOOL_OR(is_tax_deductible) AS has_deductible
FROM expenses
GROUP BY user_id, EXTRACT(YEAR FROM date), category;

-- Volltextsuche Funktion
CREATE OR REPLACE FUNCTION search_inventory(
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  sku TEXT,
  status item_status,
  purchase_price DECIMAL,
  target_price DECIMAL,
  quantity INTEGER,
  category_name TEXT,
  location_name TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.title, i.sku, i.status,
    i.purchase_price, i.target_price, i.quantity,
    c.name AS category_name,
    l.name AS location_name,
    ts_rank(
      to_tsvector('german', i.title || ' ' || COALESCE(i.description, '') || ' ' || COALESCE(i.sku, '')),
      plainto_tsquery('german', p_query)
    ) AS rank
  FROM inventory_items i
  LEFT JOIN categories c ON i.category_id = c.id
  LEFT JOIN storage_locations l ON i.location_id = l.id
  WHERE i.user_id = p_user_id
    AND (
      to_tsvector('german', i.title || ' ' || COALESCE(i.description, '') || ' ' || COALESCE(i.sku, ''))
      @@ plainto_tsquery('german', p_query)
      OR i.title ILIKE '%' || p_query || '%'
      OR i.sku ILIKE '%' || p_query || '%'
      OR i.ean ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
