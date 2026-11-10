-- ============================================================================
-- Fix: generate_redemption_code() failed with
--   "column reference \"code\" is ambiguous"
-- because the PL/pgSQL variable `code` shadowed the redemption_codes.code
-- column in its uniqueness check. This made every order transition to
-- payment_status = 'paid' fail inside ensure_redemption_code_on_paid.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_redemption_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_exists boolean := true;
BEGIN
  WHILE v_exists LOOP
    -- Generate 8-character alphanumeric code
    v_code := UPPER(SUBSTRING(MD5(random()::text || now()::text) FROM 1 FOR 8));

    -- Fully qualify the column and use a distinctly named variable so the
    -- reference can never be ambiguous.
    SELECT EXISTS (
      SELECT 1
      FROM public.redemption_codes rc
      WHERE rc.code = v_code
    )
    INTO v_exists;
  END LOOP;

  RETURN v_code;
END;
$function$;

-- Harden the trigger function's search_path as well (it is SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.ensure_redemption_code_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_code_id uuid;
  v_existing_code_id uuid;
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.redemption_code_id IS NULL THEN

    -- If a redemption code already exists for this order, link it
    SELECT rc.id INTO v_existing_code_id
    FROM public.redemption_codes rc
    WHERE rc.order_id = NEW.id
    LIMIT 1;

    IF v_existing_code_id IS NOT NULL THEN
      NEW.redemption_code_id := v_existing_code_id;
      RETURN NEW;
    END IF;

    -- Generate a new unique code
    v_code := public.generate_redemption_code();

    INSERT INTO public.redemption_codes (order_id, shop_id, code, status)
    VALUES (NEW.id, NEW.shop_id, v_code, 'active')
    RETURNING id INTO v_code_id;

    NEW.redemption_code_id := v_code_id;
  END IF;

  RETURN NEW;
END;
$function$;
