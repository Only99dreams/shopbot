-- Create platform_settings table for admin-configurable values
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage platform settings"
  ON public.platform_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Anyone can read settings (for displaying prices on public pages)
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings
  FOR SELECT
  USING (true);

-- Insert default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('subscription_plans', '{
    "starter": {"name": "Starter", "price": 0, "features": ["Up to 20 products", "Basic analytics", "WhatsApp support"]},
    "pro": {"name": "Pro", "price": 5000, "features": ["Up to 100 products", "Advanced analytics", "Priority support", "Custom domain"]},
    "business": {"name": "Business", "price": 15000, "features": ["Unlimited products", "Full analytics", "Dedicated support", "Custom domain", "API access"]}
  }', 'Subscription plan configuration'),
  ('referral_earnings', '{
    "signup_bonus": 500,
    "subscription_percentage": 10,
    "min_payout": 5000
  }', 'Referral program configuration');

-- Create trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();