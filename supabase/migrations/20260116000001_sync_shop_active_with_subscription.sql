-- Sync shop is_active with subscription status
-- Shops should be inactive by default until subscription is activated

-- Update handle_new_user to create shops with is_active = false
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
  
  -- Create shop for the seller with is_active = false (requires subscription)
  INSERT INTO public.shops (owner_id, name, whatsapp_number, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'shop_name', 'My Shop'),
    NEW.raw_user_meta_data ->> 'phone',
    false  -- Shop is inactive until subscription is paid
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

-- Create function to sync shop is_active with subscription status
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

-- Create trigger to automatically sync shop active status with subscription
DROP TRIGGER IF EXISTS on_subscription_status_change ON public.subscriptions;
CREATE TRIGGER on_subscription_status_change
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_shop_active_with_subscription();

-- Update existing shops: set is_active based on subscription status
UPDATE public.shops s
SET is_active = (
  SELECT sub.status = 'active'
  FROM public.subscriptions sub
  WHERE sub.shop_id = s.id
);

-- For shops without subscriptions (edge case), set inactive
UPDATE public.shops s
SET is_active = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions sub WHERE sub.shop_id = s.id
);

