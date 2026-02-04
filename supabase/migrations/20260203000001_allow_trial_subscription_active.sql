-- Treat trial subscriptions as active for marketplace visibility

CREATE OR REPLACE FUNCTION public.sync_shop_active_with_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When subscription status changes, update shop is_active accordingly
  IF NEW.status IN ('active', 'trial') THEN
    UPDATE public.shops
    SET is_active = true
    WHERE id = NEW.shop_id;
  ELSIF NEW.status IN ('inactive', 'cancelled', 'expired') THEN
    UPDATE public.shops
    SET is_active = false
    WHERE id = NEW.shop_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Update existing shops: set is_active based on subscription status
UPDATE public.shops s
SET is_active = (
  SELECT sub.status IN ('active', 'trial')
  FROM public.subscriptions sub
  WHERE sub.shop_id = s.id
);

-- For shops without subscriptions (edge case), set inactive
UPDATE public.shops s
SET is_active = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions sub WHERE sub.shop_id = s.id
);
