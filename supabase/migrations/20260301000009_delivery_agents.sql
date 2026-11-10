-- ============================================================================
-- Delivery agents, location based delivery assignments, earnings and
-- in-app notifications.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  state text NOT NULL,
  city text NOT NULL,
  address text,
  vehicle_type text NOT NULL DEFAULT 'motorcycle',
  vehicle_plate text,
  id_type text NOT NULL DEFAULT 'nin',
  id_number text NOT NULL,
  id_document_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_available boolean NOT NULL DEFAULT true,
  rejection_reason text,
  rating numeric(3, 2) NOT NULL DEFAULT 5.00,
  total_deliveries integer NOT NULL DEFAULT 0,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_agents_status_idx
  ON public.delivery_agents (status);
CREATE INDEX IF NOT EXISTS delivery_agents_location_idx
  ON public.delivery_agents (lower(state), lower(city));
CREATE INDEX IF NOT EXISTS delivery_agents_user_idx
  ON public.delivery_agents (user_id);

CREATE TABLE IF NOT EXISTS public.delivery_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  -- Empty city means "state-wide default".
  city text NOT NULL DEFAULT '',
  fee numeric(12, 2) NOT NULL DEFAULT 1500 CHECK (fee >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state, city)
);

CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.delivery_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'picked_up', 'delivered', 'cancelled')),
  delivery_fee numeric(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  agent_earning numeric(12, 2) NOT NULL DEFAULT 0 CHECK (agent_earning >= 0),
  platform_commission numeric(12, 2) NOT NULL DEFAULT 0 CHECK (platform_commission >= 0),
  state text NOT NULL,
  city text NOT NULL DEFAULT '',
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_assignments_status_idx
  ON public.delivery_assignments (status);
CREATE INDEX IF NOT EXISTS delivery_assignments_agent_idx
  ON public.delivery_assignments (agent_id);
CREATE INDEX IF NOT EXISTS delivery_assignments_shop_idx
  ON public.delivery_assignments (shop_id);
CREATE INDEX IF NOT EXISTS delivery_assignments_location_idx
  ON public.delivery_assignments (lower(state), lower(city), status);

CREATE TABLE IF NOT EXISTS public.delivery_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  available_balance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  total_earned numeric(12, 2) NOT NULL DEFAULT 0,
  total_withdrawn numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_notes text,
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one open payout request per agent.
CREATE UNIQUE INDEX IF NOT EXISTS delivery_payout_requests_one_pending_idx
  ON public.delivery_payout_requests (agent_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS delivery_payout_requests_agent_idx
  ON public.delivery_payout_requests (agent_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'system'
    CHECK (type IN ('system', 'order', 'delivery', 'payout', 'verification', 'message')),
  link text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id)
  WHERE is_read = false;

-- ---------------------------------------------------------------------------
-- 2. Order delivery columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_city text;

-- ---------------------------------------------------------------------------
-- 3. Updated-at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS set_delivery_agents_updated_at ON public.delivery_agents;
CREATE TRIGGER set_delivery_agents_updated_at
  BEFORE UPDATE ON public.delivery_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_delivery_fees_updated_at ON public.delivery_fees;
CREATE TRIGGER set_delivery_fees_updated_at
  BEFORE UPDATE ON public.delivery_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_delivery_assignments_updated_at ON public.delivery_assignments;
CREATE TRIGGER set_delivery_assignments_updated_at
  BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_delivery_wallets_updated_at ON public.delivery_wallets;
CREATE TRIGGER set_delivery_wallets_updated_at
  BEFORE UPDATE ON public.delivery_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_delivery_payout_requests_updated_at ON public.delivery_payout_requests;
CREATE TRIGGER set_delivery_payout_requests_updated_at
  BEFORE UPDATE ON public.delivery_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. Settings / fee helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_delivery_commission()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (value ->> 'percentage')::numeric
       FROM public.platform_settings
      WHERE key = 'delivery_commission'),
    15
  );
$$;

CREATE OR REPLACE FUNCTION public.get_delivery_fee(p_state text, p_city text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fee numeric;
BEGIN
  IF p_state IS NULL OR length(trim(p_state)) = 0 THEN
    RETURN 0;
  END IF;

  SELECT fee
    INTO v_fee
    FROM public.delivery_fees
   WHERE is_active
     AND lower(state) = lower(trim(p_state))
     AND (city = '' OR lower(city) = lower(trim(COALESCE(p_city, ''))))
   ORDER BY (city = '') ASC, fee ASC
   LIMIT 1;

  -- Fall back to the platform-wide default when the state has no configured fee.
  IF v_fee IS NULL THEN
    SELECT COALESCE((value ->> 'default_fee')::numeric, 1500)
      INTO v_fee
      FROM public.platform_settings
     WHERE key = 'delivery_commission';
  END IF;

  RETURN COALESCE(v_fee, 1500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_fee(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_commission() TO authenticated;

-- Seed a sensible state-wide default for every state, plus Lagos/FCT rates.
INSERT INTO public.delivery_fees (state, city, fee)
SELECT s.state, '', s.fee
FROM (VALUES
  ('Lagos', 1500), ('FCT', 1500), ('Rivers', 2000), ('Oyo', 2000),
  ('Kano', 2000), ('Enugu', 2000), ('Kaduna', 2000), ('Anambra', 2000),
  ('Delta', 2000), ('Edo', 2000), ('Ogun', 1800), ('Abia', 2000),
  ('Adamawa', 2500), ('Akwa Ibom', 2200), ('Bauchi', 2500), ('Bayelsa', 2500),
  ('Benue', 2500), ('Borno', 3000), ('Cross River', 2500), ('Ebonyi', 2200),
  ('Ekiti', 2200), ('Gombe', 2500), ('Imo', 2000), ('Jigawa', 2500),
  ('Katsina', 2500), ('Kebbi', 2500), ('Kogi', 2200), ('Kwara', 2200),
  ('Nasarawa', 2200), ('Niger', 2500), ('Ondo', 2200), ('Osun', 2000),
  ('Plateau', 2500), ('Sokoto', 2500), ('Taraba', 2800), ('Yobe', 3000),
  ('Zamfara', 2800)
) AS s(state, fee)
ON CONFLICT (state, city) DO NOTHING;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'delivery_commission',
  '{"percentage": 15, "default_fee": 1500, "min_payout": 2000}'::jsonb,
  'Delivery agent commission, default fee and minimum payout'
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. create_order with delivery support
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_order(uuid, text, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_address text,
  p_notes text,
  p_items jsonb,
  p_delivery_state text DEFAULT NULL,
  p_delivery_city text DEFAULT NULL
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
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
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
    delivery_fee, delivery_state, delivery_city
  )
  VALUES (
    p_shop_id, v_customer_id, v_order_number, v_subtotal, v_total,
    COALESCE(p_address, '')
      || CASE WHEN p_notes IS NOT NULL AND p_notes <> ''
              THEN E'\n\nNotes: ' || p_notes ELSE '' END,
    'pending', 'unpaid', 'flutterwave',
    COALESCE(v_delivery_fee, 0),
    NULLIF(trim(p_delivery_state), ''),
    NULLIF(trim(p_delivery_city), '')
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
    'subtotal', v_subtotal,
    'delivery_fee', COALESCE(v_delivery_fee, 0),
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(uuid, text, text, text, text, text, jsonb, text, text)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Assignment creation + agent notification on paid orders
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_delivery_assignment_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent record;
  v_pct numeric := public.get_delivery_commission();
  v_fee numeric;
BEGIN
  IF NEW.payment_status <> 'paid' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_state IS NULL OR length(trim(NEW.delivery_state)) = 0 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.delivery_assignments WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_fee := COALESCE(NEW.delivery_fee, 0);
  IF v_fee <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.delivery_assignments (
    order_id, shop_id, status, delivery_fee, agent_earning,
    platform_commission, state, city
  )
  VALUES (
    NEW.id,
    NEW.shop_id,
    'open',
    v_fee,
    round(v_fee * (1 - COALESCE(v_pct, 15) / 100), 2),
    round(v_fee * COALESCE(v_pct, 15) / 100, 2),
    NEW.delivery_state,
    COALESCE(NEW.delivery_city, '')
  )
  ON CONFLICT (order_id) DO NOTHING;

  -- Notify every approved, available agent in the same location.
  FOR v_agent IN
    SELECT user_id
      FROM public.delivery_agents
     WHERE status = 'approved'
       AND is_available
       AND lower(state) = lower(NEW.delivery_state)
       AND (NEW.delivery_city IS NULL OR NEW.delivery_city = ''
            OR lower(city) = lower(NEW.delivery_city))
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link, data)
    VALUES (
      v_agent.user_id,
      'New delivery available',
      'An order is ready for pickup in '
        || COALESCE(NULLIF(NEW.delivery_city, ''), NEW.delivery_state)
        || '.',
      'delivery',
      '/delivery/dashboard',
      jsonb_build_object('order_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_delivery_assignment_on_paid ON public.orders;
CREATE TRIGGER create_delivery_assignment_on_paid
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_delivery_assignment_on_paid();

-- ---------------------------------------------------------------------------
-- 7. Agent RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_delivery(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_agent public.delivery_agents%ROWTYPE;
  v_assignment public.delivery_assignments%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_agent
    FROM public.delivery_agents
   WHERE user_id = v_user AND status = 'approved'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only approved delivery agents can accept deliveries';
  END IF;

  SELECT * INTO v_assignment
    FROM public.delivery_assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  IF v_assignment.status <> 'open' THEN
    RAISE EXCEPTION 'This delivery has already been taken';
  END IF;

  UPDATE public.delivery_assignments
     SET agent_id = v_agent.id,
         status = 'accepted',
         accepted_at = now()
   WHERE id = p_assignment_id;

  INSERT INTO public.notifications (user_id, title, body, type, link, data)
  SELECT s.owner_id,
         'Delivery agent assigned',
         'An agent has accepted delivery for order ' || o.order_number || '.',
         'delivery',
         '/dashboard/orders',
         jsonb_build_object('order_id', o.id)
    FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
   WHERE o.id = v_assignment.order_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'agent_id', v_agent.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_delivery_status(p_assignment_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_agent public.delivery_agents%ROWTYPE;
  v_assignment public.delivery_assignments%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('picked_up', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid delivery status';
  END IF;

  SELECT * INTO v_agent
    FROM public.delivery_agents
   WHERE user_id = v_user
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a delivery agent';
  END IF;

  SELECT * INTO v_assignment
    FROM public.delivery_assignments
   WHERE id = p_assignment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  IF v_assignment.agent_id IS DISTINCT FROM v_agent.id THEN
    RAISE EXCEPTION 'This delivery is not assigned to you';
  END IF;

  IF v_assignment.status = 'delivered' THEN
    RAISE EXCEPTION 'This delivery has already been completed';
  END IF;

  IF v_assignment.status NOT IN ('accepted', 'picked_up') THEN
    RAISE EXCEPTION 'This delivery cannot be updated';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_assignment.order_id;

  IF p_status = 'cancelled' THEN
    UPDATE public.delivery_assignments
       SET status = 'open',
           agent_id = NULL,
           accepted_at = NULL,
           picked_up_at = NULL,
           cancelled_at = now()
     WHERE id = p_assignment_id;

    INSERT INTO public.notifications (user_id, title, body, type, link, data)
    SELECT s.owner_id,
           'Delivery re-opened',
           'The agent cancelled delivery for order ' || o.order_number || '. It is available again.',
           'delivery',
           '/dashboard/orders',
           jsonb_build_object('order_id', o.id)
      FROM public.orders o
      JOIN public.shops s ON s.id = o.shop_id
     WHERE o.id = v_assignment.order_id;

    RETURN jsonb_build_object('success', true, 'status', 'open');
  END IF;

  IF p_status = 'picked_up' THEN
    UPDATE public.delivery_assignments
       SET status = 'picked_up',
           picked_up_at = now()
     WHERE id = p_assignment_id;

    INSERT INTO public.notifications (user_id, title, body, type, link, data)
    SELECT c.user_id,
           'Order on the way',
           'Your order ' || v_order.order_number || ' has been picked up and is on its way.',
           'delivery',
           '/marketplace',
           jsonb_build_object('order_id', v_order.id)
      FROM public.customers c
     WHERE c.id = v_order.customer_id
       AND c.user_id IS NOT NULL;

    RETURN jsonb_build_object('success', true, 'status', 'picked_up');
  END IF;

  -- delivered
  UPDATE public.delivery_assignments
     SET status = 'delivered',
         delivered_at = now()
   WHERE id = p_assignment_id;

  UPDATE public.delivery_agents
     SET total_deliveries = total_deliveries + 1
   WHERE id = v_agent.id;

  INSERT INTO public.delivery_wallets (agent_id, available_balance, total_earned)
  VALUES (v_agent.id, v_assignment.agent_earning, v_assignment.agent_earning)
  ON CONFLICT (agent_id) DO UPDATE
    SET available_balance = public.delivery_wallets.available_balance + EXCLUDED.available_balance,
        total_earned = public.delivery_wallets.total_earned + EXCLUDED.total_earned,
        updated_at = now();

  UPDATE public.orders
     SET status = 'completed'
   WHERE id = v_order.id
     AND status = 'processing';

  INSERT INTO public.notifications (user_id, title, body, type, link, data)
  SELECT s.owner_id,
         'Order delivered',
         'Order ' || v_order.order_number || ' has been delivered.',
         'delivery',
         '/dashboard/orders',
         jsonb_build_object('order_id', v_order.id)
    FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
   WHERE o.id = v_order.id;

  INSERT INTO public.notifications (user_id, title, body, type, link, data)
  SELECT c.user_id,
         'Order delivered',
         'Your order ' || v_order.order_number || ' has been delivered. Thank you!',
         'delivery',
         '/marketplace',
         jsonb_build_object('order_id', v_order.id)
    FROM public.customers c
   WHERE c.id = v_order.customer_id
     AND c.user_id IS NOT NULL;

  RETURN jsonb_build_object('success', true, 'status', 'delivered');
END;
$$;

CREATE OR REPLACE FUNCTION public.request_delivery_payout(
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_agent public.delivery_agents%ROWTYPE;
  v_wallet public.delivery_wallets%ROWTYPE;
  v_min numeric;
  v_request_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter a valid payout amount';
  END IF;

  IF length(trim(COALESCE(p_bank_name, ''))) = 0
     OR length(trim(COALESCE(p_account_number, ''))) < 6
     OR length(trim(COALESCE(p_account_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Complete bank details are required';
  END IF;

  SELECT * INTO v_agent
    FROM public.delivery_agents
   WHERE user_id = v_user AND status = 'approved'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only approved delivery agents can request payouts';
  END IF;

  SELECT COALESCE((value ->> 'min_payout')::numeric, 2000)
    INTO v_min
    FROM public.platform_settings
   WHERE key = 'delivery_commission';

  IF p_amount < COALESCE(v_min, 2000) THEN
    RAISE EXCEPTION 'Minimum payout is ₦%', COALESCE(v_min, 2000);
  END IF;

  SELECT * INTO v_wallet
    FROM public.delivery_wallets
   WHERE agent_id = v_agent.id
   FOR UPDATE;

  IF NOT FOUND OR v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  UPDATE public.delivery_wallets
     SET available_balance = available_balance - p_amount
   WHERE agent_id = v_agent.id;

  INSERT INTO public.delivery_payout_requests (
    agent_id, amount, bank_name, account_number, account_name
  )
  VALUES (
    v_agent.id, p_amount, trim(p_bank_name), trim(p_account_number), trim(p_account_name)
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_delivery_payout(
  p_request_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request public.delivery_payout_requests%ROWTYPE;
  v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can review payouts';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT * INTO v_request
    FROM public.delivery_payout_requests
   WHERE id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This payout request has already been processed';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.delivery_payout_requests
       SET status = 'approved',
           admin_notes = p_note,
           processed_at = now(),
           processed_by = auth.uid()
     WHERE id = p_request_id;

    UPDATE public.delivery_wallets
       SET total_withdrawn = total_withdrawn + v_request.amount
     WHERE agent_id = v_request.agent_id;
  ELSE
    UPDATE public.delivery_payout_requests
       SET status = 'rejected',
           admin_notes = p_note,
           processed_at = now(),
           processed_by = auth.uid()
     WHERE id = p_request_id;

    -- Return the reserved amount to the agent's available balance.
    UPDATE public.delivery_wallets
       SET available_balance = available_balance + v_request.amount
     WHERE agent_id = v_request.agent_id;
  END IF;

  SELECT user_id INTO v_user_id
    FROM public.delivery_agents
   WHERE id = v_request.agent_id;

  INSERT INTO public.notifications (user_id, title, body, type, link, data)
  VALUES (
    v_user_id,
    CASE WHEN p_action = 'approve' THEN 'Payout approved' ELSE 'Payout rejected' END,
    CASE WHEN p_action = 'approve'
         THEN 'Your payout of ₦' || v_request.amount || ' has been approved.'
         ELSE 'Your payout of ₦' || v_request.amount || ' was rejected.'
              || COALESCE(' Reason: ' || p_note, '') END,
    'payout',
    '/delivery/dashboard',
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object('success', true, 'status', p_action);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_delivery_agent(
  p_agent_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent public.delivery_agents%ROWTYPE;
  v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can review delivery agents';
  END IF;

  IF p_action NOT IN ('approve', 'reject', 'suspend', 'reinstate') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT * INTO v_agent FROM public.delivery_agents WHERE id = p_agent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery agent not found';
  END IF;

  v_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'suspend' THEN 'suspended'
    ELSE 'approved'
  END;

  UPDATE public.delivery_agents
     SET status = v_status,
         rejection_reason = CASE WHEN v_status IN ('rejected', 'suspended') THEN p_reason ELSE NULL END,
         approved_at = CASE WHEN v_status = 'approved' THEN now() ELSE approved_at END,
         approved_by = CASE WHEN v_status = 'approved' THEN auth.uid() ELSE approved_by END,
         is_available = CASE WHEN v_status = 'approved' THEN is_available ELSE false END
   WHERE id = p_agent_id;

  IF v_status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_agent.user_id, 'delivery_agent')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, link, data)
  VALUES (
    v_agent.user_id,
    CASE v_status
      WHEN 'approved' THEN 'Delivery agent approved'
      WHEN 'rejected' THEN 'Delivery application rejected'
      ELSE 'Delivery account suspended' END,
    CASE v_status
      WHEN 'approved' THEN 'You can now accept delivery requests.'
      WHEN 'rejected' THEN 'Your application was rejected.' || COALESCE(' Reason: ' || p_reason, '')
      ELSE 'Your delivery account has been suspended.' || COALESCE(' Reason: ' || p_reason, '') END,
    'delivery',
    '/delivery/dashboard',
    jsonb_build_object('agent_id', p_agent_id)
  );

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_delivery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_delivery_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_delivery_payout(numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_delivery_payout(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_delivery_agent(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Guards: agents cannot approve themselves or change protected fields
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_delivery_agent_self_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- auth.uid() is NULL for service_role, which is allowed to manage agents.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
      NEW.rating := 5.00;
      NEW.total_deliveries := 0;
      NEW.user_id := auth.uid();
    ELSE
      NEW.user_id := OLD.user_id;
      NEW.status := OLD.status;
      NEW.approved_at := OLD.approved_at;
      NEW.approved_by := OLD.approved_by;
      NEW.rejection_reason := OLD.rejection_reason;
      NEW.rating := OLD.rating;
      NEW.total_deliveries := OLD.total_deliveries;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_delivery_agent_self_service ON public.delivery_agents;
CREATE TRIGGER guard_delivery_agent_self_service
  BEFORE INSERT OR UPDATE ON public.delivery_agents
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_agent_self_service();

-- ---------------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- delivery_agents
DROP POLICY IF EXISTS "Agents can view own profile" ON public.delivery_agents;
CREATE POLICY "Agents can view own profile"
  ON public.delivery_agents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Agents can apply" ON public.delivery_agents;
CREATE POLICY "Agents can apply"
  ON public.delivery_agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Agents can update own profile" ON public.delivery_agents;
CREATE POLICY "Agents can update own profile"
  ON public.delivery_agents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage delivery agents" ON public.delivery_agents;
CREATE POLICY "Admins can manage delivery agents"
  ON public.delivery_agents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Shop owners can view assigned agents" ON public.delivery_agents;
CREATE POLICY "Shop owners can view assigned agents"
  ON public.delivery_agents FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.delivery_assignments da
      JOIN public.orders o ON o.id = da.order_id
      JOIN public.shops s ON s.id = o.shop_id
     WHERE da.agent_id = public.delivery_agents.id
       AND s.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Buyers can view their delivery agent" ON public.delivery_agents;
CREATE POLICY "Buyers can view their delivery agent"
  ON public.delivery_agents FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.delivery_assignments da
      JOIN public.orders o ON o.id = da.order_id
      JOIN public.customers c ON c.id = o.customer_id
     WHERE da.agent_id = public.delivery_agents.id
       AND c.user_id = auth.uid()
  ));

-- delivery_fees
DROP POLICY IF EXISTS "Anyone can view active delivery fees" ON public.delivery_fees;
CREATE POLICY "Anyone can view active delivery fees"
  ON public.delivery_fees FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage delivery fees" ON public.delivery_fees;
CREATE POLICY "Admins can manage delivery fees"
  ON public.delivery_fees FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- delivery_assignments
DROP POLICY IF EXISTS "Admins can manage deliveries" ON public.delivery_assignments;
CREATE POLICY "Admins can manage deliveries"
  ON public.delivery_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents can view matching deliveries" ON public.delivery_assignments;
CREATE POLICY "Agents can view matching deliveries"
  ON public.delivery_assignments FOR SELECT
  USING (
    agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid())
    OR (
      status = 'open'
      AND EXISTS (
        SELECT 1 FROM public.delivery_agents a
         WHERE a.user_id = auth.uid()
           AND a.status = 'approved'
           AND lower(a.state) = lower(public.delivery_assignments.state)
           AND (
             public.delivery_assignments.city = ''
             OR lower(a.city) = lower(public.delivery_assignments.city)
           )
      )
    )
  );

DROP POLICY IF EXISTS "Shop owners can view their deliveries" ON public.delivery_assignments;
CREATE POLICY "Shop owners can view their deliveries"
  ON public.delivery_assignments FOR SELECT
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Buyers can view their deliveries" ON public.delivery_assignments;
CREATE POLICY "Buyers can view their deliveries"
  ON public.delivery_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
     WHERE o.id = public.delivery_assignments.order_id
       AND c.user_id = auth.uid()
  ));

-- delivery_wallets
DROP POLICY IF EXISTS "Agents can view own wallet" ON public.delivery_wallets;
CREATE POLICY "Agents can view own wallet"
  ON public.delivery_wallets FOR SELECT
  USING (agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage delivery wallets" ON public.delivery_wallets;
CREATE POLICY "Admins can manage delivery wallets"
  ON public.delivery_wallets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- delivery_payout_requests
DROP POLICY IF EXISTS "Agents can view own payout requests" ON public.delivery_payout_requests;
CREATE POLICY "Agents can view own payout requests"
  ON public.delivery_payout_requests FOR SELECT
  USING (agent_id IN (SELECT id FROM public.delivery_agents WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage payout requests" ON public.delivery_payout_requests;
CREATE POLICY "Admins can manage payout requests"
  ON public.delivery_payout_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT ON public.delivery_fees TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_agents TO authenticated;
GRANT SELECT, UPDATE ON public.delivery_assignments TO authenticated;
GRANT SELECT ON public.delivery_wallets TO authenticated;
GRANT SELECT ON public.delivery_payout_requests TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Realtime
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 11. Storage buckets for agent documents and shop videos
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('delivery-documents', 'delivery-documents', false),
  ('product-videos', 'product-videos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Agents can upload own documents" ON storage.objects;
CREATE POLICY "Agents can upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Agents can read own documents" ON storage.objects;
CREATE POLICY "Agents can read own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Sellers can upload own videos" ON storage.objects;
CREATE POLICY "Sellers can upload own videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Sellers can read own videos" ON storage.objects;
CREATE POLICY "Sellers can read own videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-videos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Sellers can delete own videos" ON storage.objects;
CREATE POLICY "Sellers can delete own videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 12. handle_new_user: delivery agents skip shop + subscription creation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _own_referral_code TEXT;
  _incoming_referral_code TEXT;
  _referrer_id UUID;
  _shop_id UUID;
  _desired_name TEXT;
  _account_type TEXT;
BEGIN
  _account_type := lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'seller')));

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone'
  );

  -- Generate this user's own referral code (used by both account types)
  _own_referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, _own_referral_code);

  -- Record the referral, if any, from signup metadata. Never let a bad code
  -- break signup.
  BEGIN
    _incoming_referral_code := NULLIF(
      trim(COALESCE(NEW.raw_user_meta_data ->> 'referral_code', '')),
      ''
    );

    IF _incoming_referral_code IS NOT NULL THEN
      SELECT rc.user_id
        INTO _referrer_id
        FROM public.referral_codes rc
       WHERE upper(rc.code) = upper(_incoming_referral_code)
       LIMIT 1;

      IF _referrer_id IS NOT NULL AND _referrer_id <> NEW.id THEN
        INSERT INTO public.referrals (
          referrer_id, referred_id, referral_code, status, reward_amount
        )
        VALUES (
          _referrer_id, NEW.id, upper(_incoming_referral_code), 'pending', 200
        )
        ON CONFLICT (referrer_id, referred_id) DO NOTHING;

        IF FOUND THEN
          UPDATE public.referral_codes
             SET total_referrals = total_referrals + 1
           WHERE user_id = _referrer_id;
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Referral bookkeeping must never block account creation.
    NULL;
  END;

  -- Delivery agents do not get a shop or a subscription.
  IF _account_type = 'delivery_agent' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'delivery_agent')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
  END IF;

  -- Assign seller role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'seller')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Shop names are globally unique (case-insensitive). Use a deterministic
  -- suffix so a second signup can never collide on the default name.
  _desired_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'shop_name', '')), '');
  IF _desired_name IS NULL THEN
    _desired_name := 'My Shop ' || substr(NEW.id::text, 1, 6);
  END IF;

  -- Create shop for the seller with is_active = false (requires subscription)
  BEGIN
    INSERT INTO public.shops (owner_id, name, whatsapp_number, is_active)
    VALUES (
      NEW.id,
      _desired_name,
      NEW.raw_user_meta_data ->> 'phone',
      false  -- Shop is inactive until subscription is paid
    )
    RETURNING id INTO _shop_id;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.shops (owner_id, name, whatsapp_number, is_active)
    VALUES (
      NEW.id,
      _desired_name || ' ' || substr(NEW.id::text, 1, 6),
      NEW.raw_user_meta_data ->> 'phone',
      false
    )
    RETURNING id INTO _shop_id;
  END;

  -- Create INACTIVE subscription - user must pay to activate
  INSERT INTO public.subscriptions (shop_id, plan, status)
  VALUES (_shop_id, 'starter', 'inactive');

  RETURN NEW;
END;
$$;
