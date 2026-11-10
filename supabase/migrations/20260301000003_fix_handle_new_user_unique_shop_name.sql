-- ============================================================================
-- Fix: signup failed for every user after the first one.
--   handle_new_user() always inserted a shop named 'My Shop', which now
--   violates shops_name_unique_idx (unique lower(name)) from
--   20260216000002_unique_shop_names.sql. The auth.users INSERT therefore
--   raised a duplicate-key error and the whole signup returned 500.
--
--   * default shop names now include a short unique suffix
--   * user-supplied names are kept, but fall back to a suffixed name if taken
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _referral_code TEXT;
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
    -- The requested name is already taken; keep signup working by appending
    -- a short, unique suffix derived from the new user id.
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

  -- Generate referral code
  _referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, _referral_code);

  RETURN NEW;
END;
$function$;
