-- ============================================================================
-- RLS hardening, server-side referral capture, and a safe admin
-- payment-proof approval path.
--
-- Problems fixed here:
--   * redemption_codes was world-readable  -> anyone could list every code
--   * payments accepted INSERTs from anyone -> fake payment history
--   * payment_proofs accepted INSERTs from anyone -> spam / forged proofs
--   * shop owners could INSERT/UPDATE their own subscriptions -> free plans
--   * referrals accepted INSERTs from anyone -> forged referral rewards
--   * add_referral_earnings / increment_referral_count were callable by
--     anon + authenticated -> free money
--   * shop owners could flip shops.is_active by hand -> bypass subscriptions
--   * referrals were recorded client-side (forgeable) instead of at signup
--   * admin payment-proof approval duplicated redemption codes and was not
--     idempotent, so double clicks double-credited wallets
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the overly broad policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read redemption codes by code" ON public.redemption_codes;
DROP POLICY IF EXISTS "Anyone can create payments" ON public.payments;
DROP POLICY IF EXISTS "Anyone can create payment proofs" ON public.payment_proofs;
DROP POLICY IF EXISTS "Shop owners can insert their subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Shop owners can update their subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Anyone can create referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can manage their referral code" ON public.referral_codes;

-- ---------------------------------------------------------------------------
-- 2. Order-aware payment proof insert policy
--
-- Guests (anon) may submit a bank-transfer proof for an order they just
-- created. The helper verifies the order really belongs to the shop and that
-- the declared amount matches the server-computed order total, so a buyer
-- cannot under-declare the amount they paid.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_accepts_payment_proof(
  p_order_id uuid,
  p_shop_id uuid,
  p_amount numeric
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.shop_id = p_shop_id
      AND o.payment_status IS DISTINCT FROM 'paid'
      AND round(o.total, 2) = round(COALESCE(p_amount, 0), 2)
  );
$function$;

-- The policy is evaluated as the caller, so anon/authenticated need EXECUTE.
GRANT EXECUTE ON FUNCTION public.order_accepts_payment_proof(uuid, uuid, numeric)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Buyers can submit order payment proofs" ON public.payment_proofs;
CREATE POLICY "Buyers can submit order payment proofs"
  ON public.payment_proofs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND payment_type = 'order'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_notes IS NULL
    AND public.order_accepts_payment_proof(reference_id, shop_id, amount)
  );

-- Shop owners may also submit their own subscription payment proofs.
DROP POLICY IF EXISTS "Shop owners can submit subscription payment proofs" ON public.payment_proofs;
CREATE POLICY "Shop owners can submit subscription payment proofs"
  ON public.payment_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending'
    AND payment_type = 'subscription'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_notes IS NULL
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = payment_proofs.shop_id
        AND s.owner_id = auth.uid()
    )
  );

-- Users may read their own referral code, but never edit its balances.
DROP POLICY IF EXISTS "Users can view their referral code" ON public.referral_codes;
CREATE POLICY "Users can view their referral code"
  ON public.referral_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Lock down the exposed money/referral RPCs
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.add_referral_earnings(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_referral_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_redemption_code() FROM PUBLIC, anon, authenticated;

-- Trigger functions should never be directly callable either.
REVOKE ALL ON FUNCTION public.ensure_redemption_code_for_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_subscription_on_payment_proof() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_referral_on_subscription_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_referral_on_subscription_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_shop_active_with_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Stop sellers from self-activating their shop
--
-- Internal writers (handle_new_user, sync_shop_active_with_subscription) run
-- as postgres, admins are allowed explicitly, and service_role is allowed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_shop_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Internal/server-side writers run as the table owner or service role.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active IS TRUE THEN
      RAISE EXCEPTION 'Shops cannot be activated without an approved subscription';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Shop activation is managed by the platform';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_shop_activation_trg ON public.shops;
CREATE TRIGGER guard_shop_activation_trg
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.guard_shop_activation();

-- ---------------------------------------------------------------------------
-- 5. Record referrals server-side at signup
--
-- The client sends referral_code in signup metadata; we resolve it here so a
-- caller cannot invent a referrer, and we count the signup exactly once.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _own_referral_code TEXT;
  _incoming_referral_code TEXT;
  _referrer_id UUID;
  _shop_id UUID;
  _desired_name TEXT;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone'
  );

  -- Assign seller role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'seller');

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

  -- Generate this user's own referral code
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

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Referral completion should award money, not recount signups
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_referral_on_subscription_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _shop_owner_id UUID;
  _referral RECORD;
  _reward_amount DECIMAL := 200;
BEGIN
  IF NEW.payment_type = 'subscription'
     AND NEW.status = 'approved'
     AND (OLD IS NULL OR OLD.status <> 'approved') THEN

    SELECT owner_id INTO _shop_owner_id
    FROM public.shops
    WHERE id = NEW.shop_id;

    SELECT * INTO _referral
    FROM public.referrals
    WHERE referred_id = _shop_owner_id
      AND status = 'pending'
    LIMIT 1;

    IF _referral.id IS NOT NULL THEN
      UPDATE public.referrals
      SET status = 'completed',
          reward_amount = _reward_amount
      WHERE id = _referral.id;

      -- total_referrals was already counted at signup.
      UPDATE public.referral_codes
      SET total_earnings = total_earnings + _reward_amount,
          available_balance = available_balance + _reward_amount
      WHERE user_id = _referral.referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_referral_on_subscription_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _referral RECORD;
  _reward_amount DECIMAL := 200;
BEGIN
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status <> 'active') THEN
    SELECT * INTO _referral
    FROM public.referrals
    WHERE referred_id = (SELECT owner_id FROM public.shops WHERE id = NEW.shop_id)
      AND status = 'pending'
    LIMIT 1;

    IF _referral.id IS NOT NULL THEN
      UPDATE public.referrals
      SET status = 'completed',
          reward_amount = _reward_amount
      WHERE id = _referral.id;

      -- total_referrals was already counted at signup.
      UPDATE public.referral_codes
      SET total_earnings = total_earnings + _reward_amount,
          available_balance = available_balance + _reward_amount
      WHERE user_id = _referral.referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Atomic, idempotent admin approval of bank-transfer payment proofs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_payment_proof(
  p_proof_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _proof public.payment_proofs%ROWTYPE;
  _order public.orders%ROWTYPE;
  _platform_fee numeric;
  _seller_amount numeric;
  _existing_payment_id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can approve payment proofs';
  END IF;

  SELECT * INTO _proof
    FROM public.payment_proofs
   WHERE id = p_proof_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment proof not found';
  END IF;

  -- Idempotent: a re-approval only refreshes the audit fields.
  UPDATE public.payment_proofs
     SET status = 'approved',
         admin_notes = COALESCE(p_admin_notes, admin_notes),
         reviewed_by = _uid,
         reviewed_at = now()
   WHERE id = _proof.id;

  IF _proof.payment_type = 'subscription' THEN
    INSERT INTO public.subscriptions (
      shop_id, plan, status, current_period_start, current_period_end
    )
    VALUES (
      _proof.shop_id, 'starter', 'active', now(), now() + interval '30 days'
    )
    ON CONFLICT (shop_id) DO UPDATE
      SET status = 'active',
          current_period_start = COALESCE(public.subscriptions.current_period_start, now()),
          current_period_end = now() + interval '30 days';

    -- sync_shop_active_with_subscription opens the shop.
    RETURN jsonb_build_object('success', true, 'payment_type', 'subscription');
  END IF;

  IF _proof.payment_type <> 'order' THEN
    RETURN jsonb_build_object('success', true, 'payment_type', _proof.payment_type);
  END IF;

  SELECT * INTO _order
    FROM public.orders
   WHERE id = _proof.reference_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Marking the order paid fires ensure_redemption_code_on_paid, which
  -- creates and links exactly one redemption code.
  IF _order.payment_status IS DISTINCT FROM 'paid' THEN
    UPDATE public.orders
       SET payment_status = 'paid',
           payment_method = COALESCE(payment_method, 'bank_transfer')
     WHERE id = _order.id;
  END IF;

  -- Credit only once per order, regardless of provider or double clicks.
  SELECT id INTO _existing_payment_id
    FROM public.payments
   WHERE order_id = _order.id
     AND status = 'success'
   LIMIT 1;

  IF _existing_payment_id IS NULL THEN
    _platform_fee := round(_order.total * 0.05, 2);
    _seller_amount := _order.total - _platform_fee;

    INSERT INTO public.seller_wallets (shop_id, balance, total_earned)
    VALUES (_proof.shop_id, _seller_amount, _seller_amount)
    ON CONFLICT (shop_id) DO UPDATE
      SET balance = public.seller_wallets.balance + EXCLUDED.balance,
          total_earned = public.seller_wallets.total_earned + EXCLUDED.total_earned;

    INSERT INTO public.payments (
      order_id, shop_id, amount, platform_fee, seller_amount, status,
      paystack_reference, credited_to_seller, credited_at
    )
    VALUES (
      _order.id, _proof.shop_id, _order.total, _platform_fee, _seller_amount,
      'success', 'BANK-' || _proof.id::text, true, now()
    )
    ON CONFLICT (paystack_reference) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_type', 'order',
    'order_id', _order.id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_payment_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_proof(uuid, text) TO authenticated, service_role;

-- Make the new RPCs visible to PostgREST immediately.
NOTIFY pgrst, 'reload schema';
