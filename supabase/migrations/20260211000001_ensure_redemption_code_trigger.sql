-- Ensure redemption codes are generated whenever an order is marked paid
CREATE OR REPLACE FUNCTION public.ensure_redemption_code_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code text;
  code_id uuid;
  existing_code_id uuid;
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.redemption_code_id IS NULL THEN

    -- If a redemption code already exists for this order, link it
    SELECT id INTO existing_code_id
    FROM public.redemption_codes
    WHERE order_id = NEW.id
    LIMIT 1;

    IF existing_code_id IS NOT NULL THEN
      NEW.redemption_code_id := existing_code_id;
      RETURN NEW;
    END IF;

    -- Generate a new unique code
    code := public.generate_redemption_code();

    INSERT INTO public.redemption_codes (order_id, shop_id, code, status)
    VALUES (NEW.id, NEW.shop_id, code, 'active')
    RETURNING id INTO code_id;

    NEW.redemption_code_id := code_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_redemption_code_on_paid ON public.orders;

CREATE TRIGGER ensure_redemption_code_on_paid
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_redemption_code_for_order();
