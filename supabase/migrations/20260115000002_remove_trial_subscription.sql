-- Update handle_new_user to create inactive subscription instead of trial
-- Users must pay ₦1,000 to activate their subscription

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _referral_code TEXT;
  _shop_id UUID;
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
  
  -- Create shop for the seller
  INSERT INTO public.shops (owner_id, name, whatsapp_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'shop_name', 'My Shop'),
    NEW.raw_user_meta_data ->> 'phone'
  )
  RETURNING id INTO _shop_id;
  
  -- Create INACTIVE subscription - user must pay ₦1,000 to activate
  INSERT INTO public.subscriptions (shop_id, plan, status)
  VALUES (_shop_id, 'starter', 'inactive');
  
  -- Generate referral code
  _referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, _referral_code);
  
  RETURN NEW;
END;
$$;

-- Update existing trial subscriptions to inactive (for existing users who haven't paid)
UPDATE public.subscriptions 
SET status = 'inactive', trial_ends_at = NULL 
WHERE status = 'trial';

-- Update subscription status check constraint to include 'inactive'
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check 
  CHECK (status IN ('inactive', 'trial', 'active', 'cancelled', 'expired'));
