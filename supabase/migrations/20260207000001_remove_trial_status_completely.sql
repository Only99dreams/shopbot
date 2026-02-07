-- Remove trial status completely from the system
-- Convert any remaining trial subscriptions to inactive (they need to pay)

-- Update the sync function to only treat 'active' as valid
CREATE OR REPLACE FUNCTION public.sync_shop_active_with_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When subscription status changes, update shop is_active accordingly
  IF NEW.status = 'active' THEN
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

-- Convert any remaining trial subscriptions to inactive
UPDATE public.subscriptions
SET status = 'inactive', trial_ends_at = NULL
WHERE status = 'trial';

-- Sync shop active status: only 'active' subscriptions make shops open
UPDATE public.shops s
SET is_active = (
  SELECT sub.status = 'active'
  FROM public.subscriptions sub
  WHERE sub.shop_id = s.id
);

-- For shops without subscriptions, set inactive
UPDATE public.shops s
SET is_active = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions sub WHERE sub.shop_id = s.id
);
