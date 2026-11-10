-- ============================================================================
-- Map tracking: shop pins, delivery drop-off coordinates and live agent
-- location sharing. All coordinates are plain WGS84 lat/lng.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision,
  ADD COLUMN IF NOT EXISTS tracking_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_key
  ON public.orders (tracking_token);

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS last_lat double precision,
  ADD COLUMN IF NOT EXISTS last_lng double precision,
  ADD COLUMN IF NOT EXISTS last_location_accuracy double precision,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

CREATE INDEX IF NOT EXISTS shops_coords_idx
  ON public.shops (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS delivery_agents_live_location_idx
  ON public.delivery_agents (last_location_at DESC)
  WHERE last_lat IS NOT NULL;

-- Backfill the address that create_order historically stored inside notes.
UPDATE public.orders
   SET delivery_address = CASE
         WHEN notes IS NULL OR length(trim(notes)) = 0 THEN NULL
         WHEN position(E'\n\nNotes: ' in notes) > 0
           THEN left(notes, position(E'\n\nNotes: ' in notes) - 1)
         ELSE notes
       END
 WHERE delivery_address IS NULL
   AND notes IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Coordinate range guards
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_coords_range') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_coords_range
      CHECK (
        (delivery_lat IS NULL OR delivery_lat BETWEEN -90 AND 90)
        AND (delivery_lng IS NULL OR delivery_lng BETWEEN -180 AND 180)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_coords_range') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_coords_range
      CHECK (
        (latitude IS NULL OR latitude BETWEEN -90 AND 90)
        AND (longitude IS NULL OR longitude BETWEEN -180 AND 180)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_agents_coords_range') THEN
    ALTER TABLE public.delivery_agents ADD CONSTRAINT delivery_agents_coords_range
      CHECK (
        (last_lat IS NULL OR last_lat BETWEEN -90 AND 90)
        AND (last_lng IS NULL OR last_lng BETWEEN -180 AND 180)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Agent location sharing
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_agent_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent public.delivery_agents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;

  SELECT * INTO v_agent
    FROM public.delivery_agents
   WHERE user_id = auth.uid()
     AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only approved delivery agents can share their location';
  END IF;

  UPDATE public.delivery_agents
     SET last_lat = p_lat,
         last_lng = p_lng,
         last_location_accuracy = CASE
           WHEN p_accuracy IS NULL THEN NULL
           ELSE GREATEST(p_accuracy, 0)
         END,
         last_location_at = now()
   WHERE id = v_agent.id;

  RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_agent_location(double precision, double precision, double precision)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Agent delivery list with map context
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_agent_deliveries();

CREATE OR REPLACE FUNCTION public.get_agent_deliveries()
RETURNS TABLE (
  assignment_id uuid,
  order_id uuid,
  order_number text,
  status text,
  delivery_fee numeric,
  agent_earning numeric,
  state text,
  city text,
  customer_name text,
  customer_phone text,
  address text,
  item_count integer,
  items jsonb,
  created_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  shop_name text,
  shop_latitude double precision,
  shop_longitude double precision,
  delivery_latitude double precision,
  delivery_longitude double precision,
  delivery_address text,
  tracking_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent public.delivery_agents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_agent
    FROM public.delivery_agents
   WHERE user_id = auth.uid()
     AND status = 'approved';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    da.id,
    o.id,
    o.order_number,
    da.status,
    da.delivery_fee,
    da.agent_earning,
    da.state,
    da.city,
    c.name,
    CASE WHEN da.agent_id = v_agent.id THEN c.phone ELSE NULL END,
    CASE WHEN da.agent_id = v_agent.id THEN COALESCE(o.delivery_address, o.notes) ELSE NULL END,
    COALESCE((SELECT count(*)::int FROM public.order_items oi WHERE oi.order_id = o.id), 0),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('name', oi.product_name, 'quantity', oi.quantity))
         FROM public.order_items oi
        WHERE oi.order_id = o.id),
      '[]'::jsonb
    ),
    da.created_at,
    da.accepted_at,
    da.delivered_at,
    s.name,
    s.latitude,
    s.longitude,
    CASE WHEN da.agent_id = v_agent.id THEN o.delivery_lat END,
    CASE WHEN da.agent_id = v_agent.id THEN o.delivery_lng END,
    CASE WHEN da.agent_id = v_agent.id THEN COALESCE(o.delivery_address, o.notes) END,
    o.tracking_token
  FROM public.delivery_assignments da
  JOIN public.orders o ON o.id = da.order_id
  JOIN public.shops s ON s.id = o.shop_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE da.agent_id = v_agent.id
     OR (
       da.status = 'open'
       AND lower(da.state) = lower(v_agent.state)
       AND (da.city = '' OR lower(da.city) = lower(v_agent.city))
     )
  ORDER BY
    CASE da.status WHEN 'open' THEN 0 WHEN 'accepted' THEN 1 WHEN 'picked_up' THEN 2 ELSE 3 END,
    da.created_at DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_deliveries() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Public tracking payload (order number based, as before)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.track_order_by_number(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'total', o.total,
    'status', o.status,
    'payment_status', o.payment_status,
    'created_at', o.created_at,
    'redemption_confirmed', o.redemption_confirmed,
    'shops', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'logo_url', s.logo_url,
      'state', s.state,
      'city', s.city,
      'address', s.address,
      'latitude', s.latitude,
      'longitude', s.longitude
    ),
    'order_items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
          )
        )
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ),
    'destination', jsonb_build_object(
      'latitude', o.delivery_lat,
      'longitude', o.delivery_lng,
      'address', COALESCE(o.delivery_address, o.notes),
      'state', o.delivery_state,
      'city', o.delivery_city
    ),
    'delivery', CASE
      WHEN da.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'assignment_id', da.id,
        'status', da.status,
        'accepted_at', da.accepted_at,
        'picked_up_at', da.picked_up_at,
        'delivered_at', da.delivered_at,
        'agent', CASE
          WHEN ag.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'full_name', ag.full_name,
            'phone', ag.phone,
            'vehicle_type', ag.vehicle_type,
            'vehicle_plate', ag.vehicle_plate,
            'rating', ag.rating,
            'last_lat', ag.last_lat,
            'last_lng', ag.last_lng,
            'last_location_accuracy', ag.last_location_accuracy,
            'last_location_at', ag.last_location_at
          )
        END
      )
    END
  )
  INTO result
  FROM public.orders o
  JOIN public.shops s ON s.id = o.shop_id
  LEFT JOIN LATERAL (
    SELECT da2.*
      FROM public.delivery_assignments da2
     WHERE da2.order_id = o.id
     ORDER BY
       CASE da2.status
         WHEN 'picked_up' THEN 0
         WHEN 'accepted' THEN 1
         WHEN 'delivered' THEN 2
         ELSE 3
       END,
       da2.created_at DESC
     LIMIT 1
  ) da ON true
  LEFT JOIN public.delivery_agents ag ON ag.id = da.agent_id
  WHERE UPPER(TRIM(o.order_number)) = UPPER(TRIM(p_order_number));

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_order_by_number(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Public shops map data
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_shops_map(
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  state text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  product_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    s.name,
    s.logo_url,
    s.state,
    s.city,
    s.address,
    s.latitude,
    s.longitude,
    COALESCE((SELECT count(*)::int FROM public.products p WHERE p.shop_id = s.id), 0)
  FROM public.shops s
  WHERE (s.is_active OR EXISTS (
           SELECT 1 FROM public.subscriptions sub
            WHERE sub.shop_id = s.id AND sub.status = 'active'
         ))
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND (p_state IS NULL OR length(trim(p_state)) = 0 OR lower(s.state) = lower(trim(p_state)))
    AND (p_city IS NULL OR length(trim(p_city)) = 0 OR lower(s.city) LIKE '%' || lower(trim(p_city)) || '%')
  ORDER BY s.name
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_shops_map(text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Admin map RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_active_delivery_map()
RETURNS TABLE (
  assignment_id uuid,
  order_id uuid,
  order_number text,
  tracking_token uuid,
  status text,
  state text,
  city text,
  delivery_fee numeric,
  agent_earning numeric,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  agent_id uuid,
  agent_name text,
  agent_phone text,
  agent_lat double precision,
  agent_lng double precision,
  agent_accuracy double precision,
  agent_location_at timestamptz,
  shop_name text,
  shop_lat double precision,
  shop_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  destination_address text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view the delivery map';
  END IF;

  RETURN QUERY
  SELECT
    da.id,
    o.id,
    o.order_number,
    o.tracking_token,
    da.status,
    da.state,
    da.city,
    da.delivery_fee,
    da.agent_earning,
    da.accepted_at,
    da.picked_up_at,
    ag.id,
    ag.full_name,
    ag.phone,
    ag.last_lat,
    ag.last_lng,
    ag.last_location_accuracy,
    ag.last_location_at,
    s.name,
    s.latitude,
    s.longitude,
    o.delivery_lat,
    o.delivery_lng,
    COALESCE(o.delivery_address, o.notes)
  FROM public.delivery_assignments da
  JOIN public.orders o ON o.id = da.order_id
  JOIN public.shops s ON s.id = da.shop_id
  LEFT JOIN public.delivery_agents ag ON ag.id = da.agent_id
  WHERE da.status IN ('accepted', 'picked_up')
  ORDER BY
    CASE da.status WHEN 'picked_up' THEN 0 ELSE 1 END,
    da.accepted_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_delivery_map() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_agent_map_overview()
RETURNS TABLE (
  agent_id uuid,
  full_name text,
  phone text,
  state text,
  city text,
  vehicle_type text,
  is_available boolean,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  active_deliveries bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view agents on the map';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.full_name,
    a.phone,
    a.state,
    a.city,
    a.vehicle_type,
    a.is_available,
    a.last_lat,
    a.last_lng,
    a.last_location_at,
    (
      SELECT count(*)
      FROM public.delivery_assignments da
      WHERE da.agent_id = a.id
        AND da.status IN ('accepted', 'picked_up')
    )
  FROM public.delivery_agents a
  WHERE a.status = 'approved'
  ORDER BY a.is_available DESC, a.last_location_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_map_overview() TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. create_order captures drop-off coordinates + tracking token
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_order(uuid, text, text, text, text, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_address text,
  p_notes text,
  p_items jsonb,
  p_delivery_state text DEFAULT NULL,
  p_delivery_city text DEFAULT NULL,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_tracking_token uuid;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_user_id uuid := auth.uid();
  v_shop_active boolean;
  v_lat double precision := p_delivery_lat;
  v_lng double precision := p_delivery_lng;
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

  IF v_lat IS NOT NULL AND (v_lat < -90 OR v_lat > 90) THEN
    RAISE EXCEPTION 'Invalid delivery latitude';
  END IF;

  IF v_lng IS NOT NULL AND (v_lng < -180 OR v_lng > 180) THEN
    RAISE EXCEPTION 'Invalid delivery longitude';
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

  -- Delivery is priced server-side so the client cannot choose its own fee.
  v_delivery_fee := public.get_delivery_fee(p_delivery_state, p_delivery_city);
  v_total := v_subtotal + COALESCE(v_delivery_fee, 0);

  -- Unique, non-sequential order number
  v_order_number := 'ORD-'
    || upper(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint))
    || '-'
    || upper(substr(md5(random()::text), 1, 5));

  INSERT INTO public.orders (
    shop_id, customer_id, order_number, subtotal, total,
    notes, status, payment_status, payment_method,
    delivery_fee, delivery_state, delivery_city,
    delivery_address, delivery_lat, delivery_lng
  )
  VALUES (
    p_shop_id, v_customer_id, v_order_number, v_subtotal, v_total,
    COALESCE(p_address, '')
      || CASE WHEN p_notes IS NOT NULL AND p_notes <> ''
              THEN E'\n\nNotes: ' || p_notes ELSE '' END,
    'pending', 'unpaid', 'flutterwave',
    COALESCE(v_delivery_fee, 0),
    NULLIF(trim(p_delivery_state), ''),
    NULLIF(trim(p_delivery_city), ''),
    NULLIF(trim(p_address), ''),
    v_lat,
    v_lng
  )
  RETURNING id, tracking_token INTO v_order_id, v_tracking_token;

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
    'tracking_token', v_tracking_token,
    'customer_id', v_customer_id,
    'subtotal', v_subtotal,
    'delivery_fee', COALESCE(v_delivery_fee, 0),
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(
  uuid, text, text, text, text, text, jsonb, text, text, double precision, double precision
) TO anon, authenticated;
