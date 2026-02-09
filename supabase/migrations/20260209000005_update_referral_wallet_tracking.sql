-- Update referral processing to track available balance

CREATE OR REPLACE FUNCTION public.process_referral_on_subscription_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop_owner_id UUID;
  _referral RECORD;
  _reward_amount DECIMAL := 200;
BEGIN
  IF NEW.payment_type = 'subscription' 
     AND NEW.status = 'approved' 
     AND (OLD IS NULL OR OLD.status != 'approved') THEN

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

      UPDATE public.referral_codes
      SET total_earnings = total_earnings + _reward_amount,
          available_balance = available_balance + _reward_amount,
          total_referrals = total_referrals + 1
      WHERE user_id = _referral.referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_referral_on_subscription_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

      UPDATE public.referral_codes
      SET total_earnings = total_earnings + _reward_amount,
          available_balance = available_balance + _reward_amount,
          total_referrals = total_referrals + 1
      WHERE user_id = _referral.referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
