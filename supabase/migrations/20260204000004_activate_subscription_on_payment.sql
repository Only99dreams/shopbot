-- Activate subscriptions when payment proof is approved

CREATE OR REPLACE FUNCTION public.activate_subscription_on_payment_proof()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_type = 'subscription'
     AND NEW.status = 'approved'
     AND (OLD IS NULL OR OLD.status <> 'approved') THEN

    -- Ensure a subscription row exists
    INSERT INTO public.subscriptions (shop_id, plan, status)
    VALUES (NEW.shop_id, 'starter', 'active')
    ON CONFLICT (shop_id) DO UPDATE
      SET status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subscription_payment_activate ON public.payment_proofs;
CREATE TRIGGER on_subscription_payment_activate
  AFTER INSERT OR UPDATE ON public.payment_proofs
  FOR EACH ROW EXECUTE FUNCTION public.activate_subscription_on_payment_proof();

-- Backfill: activate subscriptions for approved subscription payments
UPDATE public.subscriptions s
SET status = 'active'
WHERE EXISTS (
  SELECT 1
  FROM public.payment_proofs p
  WHERE p.shop_id = s.shop_id
    AND p.payment_type = 'subscription'
    AND p.status = 'approved'
);
