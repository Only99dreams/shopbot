-- ============================================================================
-- Security & data-integrity fixes
--  * enable RLS on seller_ratings
--  * subscriptions default status inactive (trials removed)
--  * unique whatsapp conversation per (shop, phone)
--  * unique order numbers
--  * link customers to auth users
--  * server-side order creation RPC (authoritative pricing / totals)
--  * stop public read/write of orders, order_items and customers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. seller_ratings RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view seller ratings" ON public.seller_ratings;
DROP POLICY IF EXISTS "Anyone can rate sellers" ON public.seller_ratings;
DROP POLICY IF EXISTS "Admins can manage seller ratings" ON public.seller_ratings;

CREATE POLICY "Anyone can view seller ratings"
  ON public.seller_ratings
  FOR SELECT
  USING (true);

-- Anonymous ratings are allowed, but an authenticated user may only set
-- their own buyer_id (prevents impersonation).
CREATE POLICY "Anyone can rate sellers"
  ON public.seller_ratings
  FOR INSERT
  WITH CHECK (buyer_id IS NULL OR buyer_id = auth.uid());

CREATE POLICY "Admins can manage seller ratings"
  ON public.seller_ratings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 2. Subscription default status
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions ALTER COLUMN status SET DEFAULT 'inactive';

-- ---------------------------------------------------------------------------
-- 3. One WhatsApp conversation per shop + customer phone
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY shop_id, customer_phone
           ORDER BY last_message_at DESC NULLS LAST, created_at DESC
         ) AS rn
  FROM public.whatsapp_conversations
)
DELETE FROM public.whatsapp_conversations w
USING ranked r
WHERE w.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_shop_phone_key
  ON public.whatsapp_conversations (shop_id, customer_phone);

-- ---------------------------------------------------------------------------
-- 4. Order numbers must be unique
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key
  ON public.orders (order_number);

-- ---------------------------------------------------------------------------
-- 5. Link customers to auth users so buyers can see their own orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers (user_id);

-- ---------------------------------------------------------------------------
-- 6. Server-side order creation (authoritative prices, totals, order number)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_address text,
  p_notes text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_user_id uuid := auth.uid();
  v_shop_active boolean;
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop is required';
  END IF;

  IF p_customer_phone IS NULL OR length(trim(p_customer_phone)) < 6 THEN
    RAISE EXCEPTION 'A valid phone number is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Shop must exist and be accepting orders
  SELECT (shops.is_active OR EXISTS (
           SELECT 1 FROM public.subscriptions s
           WHERE s.shop_id = shops.id AND s.status = 'active'
         ))
    INTO v_shop_active
    FROM public.shops
   WHERE shops.id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF NOT COALESCE(v_shop_active, false) THEN
    RAISE EXCEPTION 'This shop is not currently accepting orders';
  END IF;

  -- Upsert the customer record (link to the logged-in buyer when available)
  INSERT INTO public.customers (shop_id, phone, name, email, user_id)
  VALUES (
    p_shop_id,
    trim(p_customer_phone),
    NULLIF(trim(p_customer_name), ''),
    NULLIF(trim(p_customer_email), ''),
    v_user_id
  )
  ON CONFLICT (shop_id, phone) DO UPDATE
    SET name = COALESCE(EXCLUDED.name, public.customers.name),
        email = COALESCE(EXCLUDED.email, public.customers.email),
        user_id = COALESCE(public.customers.user_id, EXCLUDED.user_id)
  RETURNING id INTO v_customer_id;

  -- Compute the total from authoritative product prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::integer, 1));

    SELECT id, name, price, stock_quantity, is_available
      INTO v_product
      FROM public.products
     WHERE id = (v_item->>'product_id')::uuid
       AND shop_id = p_shop_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart is no longer available';
    END IF;

    IF v_product.is_available IS FALSE THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable', v_product.name;
    END IF;

    IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'Not enough stock for "%"', v_product.name;
    END IF;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  END LOOP;

  -- Unique, non-sequential order number
  v_order_number := 'ORD-'
    || upper(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint))
    || '-'
    || upper(substr(md5(random()::text), 1, 5));

  INSERT INTO public.orders (
    shop_id, customer_id, order_number, subtotal, total,
    notes, status, payment_status, payment_method
  )
  VALUES (
    p_shop_id, v_customer_id, v_order_number, v_subtotal, v_subtotal,
    COALESCE(p_address, '')
      || CASE WHEN p_notes IS NOT NULL AND p_notes <> ''
              THEN E'\n\nNotes: ' || p_notes ELSE '' END,
    'pending', 'unpaid', 'flutterwave'
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, product_name, quantity, unit_price, total_price
  )
  SELECT
    v_order_id,
    p.id,
    p.name,
    GREATEST(1, COALESCE((it->>'quantity')::integer, 1)),
    p.price,
    p.price * GREATEST(1, COALESCE((it->>'quantity')::integer, 1))
  FROM jsonb_array_elements(p_items) it
  JOIN public.products p
    ON p.id = (it->>'product_id')::uuid
   AND p.shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'total', v_subtotal
  );
END;
$function$;

-- Callable by guests (checkout works without an account) and logged-in buyers.
REVOKE ALL ON FUNCTION public.create_order(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(uuid, text, text, text, text, text, jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Lock down orders / order_items / customers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

CREATE POLICY "Customers can view own orders"
  ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = orders.customer_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

CREATE POLICY "Customers can view own order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_items.order_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can select customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can update customers" ON public.customers;

CREATE POLICY "Customers can view own customer record"
  ON public.customers
  FOR SELECT
  USING (user_id = auth.uid());
