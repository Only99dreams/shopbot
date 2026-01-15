-- Create RPC function to increment referral count
CREATE OR REPLACE FUNCTION public.increment_referral_count(referrer_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.referral_codes
  SET total_referrals = total_referrals + 1
  WHERE user_id = referrer_user_id;
END;
$$;

-- Create RPC function to add referral earnings
CREATE OR REPLACE FUNCTION public.add_referral_earnings(
  referrer_user_id UUID,
  amount DECIMAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.referral_codes
  SET total_earnings = total_earnings + amount
  WHERE user_id = referrer_user_id;
END;
$$;

-- Create function to process referral when referred user pays for subscription
CREATE OR REPLACE FUNCTION public.process_referral_on_subscription_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop_owner_id UUID;
  _referral RECORD;
  _reward_amount DECIMAL := 200; -- ₦200 reward per referral
BEGIN
  -- Only process when subscription payment proof is approved
  IF NEW.payment_type = 'subscription' 
     AND NEW.status = 'approved' 
     AND (OLD IS NULL OR OLD.status != 'approved') THEN
    
    -- Get the shop owner from the shop_id
    SELECT owner_id INTO _shop_owner_id
    FROM public.shops
    WHERE id = NEW.shop_id;

    -- Check if this user was referred and has a pending referral
    SELECT * INTO _referral
    FROM public.referrals
    WHERE referred_id = _shop_owner_id
    AND status = 'pending'
    LIMIT 1;

    -- If found, mark as completed and credit the referrer
    IF _referral.id IS NOT NULL THEN
      -- Update referral status
      UPDATE public.referrals
      SET status = 'completed',
          reward_amount = _reward_amount
      WHERE id = _referral.id;

      -- Add earnings to referrer
      UPDATE public.referral_codes
      SET total_earnings = total_earnings + _reward_amount
      WHERE user_id = _referral.referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to process referral rewards on subscription payment approval
DROP TRIGGER IF EXISTS on_subscription_payment_approved ON public.payment_proofs;
CREATE TRIGGER on_subscription_payment_approved
  AFTER INSERT OR UPDATE ON public.payment_proofs
  FOR EACH ROW EXECUTE FUNCTION public.process_referral_on_subscription_payment();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_referral_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_referral_earnings(UUID, DECIMAL) TO authenticated;

-- Add policy for inserting referrals (allow authenticated users to create referrals)
DROP POLICY IF EXISTS "Users can create referrals" ON public.referrals;
CREATE POLICY "Anyone can create referrals" 
ON public.referrals 
FOR INSERT 
WITH CHECK (true);
