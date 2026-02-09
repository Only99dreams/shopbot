-- Force shops to be inactive unless they have an active subscription

UPDATE public.shops s
SET is_active = EXISTS (
  SELECT 1
  FROM public.subscriptions sub
  WHERE sub.shop_id = s.id
    AND sub.status = 'active'
);
