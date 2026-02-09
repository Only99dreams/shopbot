-- Process referrals when a referred user's subscription becomes active

CREATE OR REPLACE FUNCTION public.process_referral_on_subscription_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referral RECORD;
  _reward_amount DECIMAL := 200; -- ₦200 reward per referral
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

      UPDATE public.referral_codes
      SET total_earnings = total_earnings + _reward_amount,
          total_referrals = total_referrals + 1
      WHERE user_id = _referral.referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subscription_status_activate_referral ON public.subscriptions;
CREATE TRIGGER on_subscription_status_activate_referral
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.process_referral_on_subscription_activation();

-- Backfill: complete pending referrals for users with active subscriptions
WITH completed AS (
  UPDATE public.referrals r
  SET status = 'completed',
      reward_amount = 200
  WHERE r.status = 'pending'
    AND r.referred_id IN (
      SELECT s.owner_id
      FROM public.subscriptions sub
      JOIN public.shops s ON s.id = sub.shop_id
      WHERE sub.status = 'active'
    )
  RETURNING r.referrer_id
),
completed_totals AS (
  SELECT referrer_id, COUNT(*) AS cnt
  FROM completed
  GROUP BY referrer_id
)
UPDATE public.referral_codes rc
SET total_earnings = total_earnings + (200 * ct.cnt),
    total_referrals = total_referrals + ct.cnt
FROM completed_totals ct
WHERE rc.user_id = ct.referrer_id;
