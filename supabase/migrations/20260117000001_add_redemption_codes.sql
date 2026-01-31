-- Create redemption_codes table for order redemption system
CREATE TABLE public.redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add redemption_confirmed field to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS redemption_confirmed boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS redemption_code_id uuid REFERENCES public.redemption_codes(id);

-- Enable RLS
ALTER TABLE public.redemption_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies for redemption_codes
CREATE POLICY "Admins can manage all redemption codes" ON public.redemption_codes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shop owners can view their redemption codes" ON public.redemption_codes
  FOR SELECT USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shop owners can update their redemption codes" ON public.redemption_codes
  FOR UPDATE USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- Allow anyone to read redemption codes by code (for redemption)
CREATE POLICY "Anyone can read redemption codes by code" ON public.redemption_codes
  FOR SELECT USING (true);

-- Update trigger for redemption_codes
CREATE TRIGGER update_redemption_codes_updated_at
  BEFORE UPDATE ON public.redemption_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique redemption code
CREATE OR REPLACE FUNCTION public.generate_redemption_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists_check boolean := true;
BEGIN
  WHILE exists_check LOOP
    -- Generate 8-character alphanumeric code
    code := UPPER(SUBSTRING(MD5(random()::text || now()::text) FROM 1 FOR 8));
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.redemption_codes WHERE redemption_codes.code = code) INTO exists_check;
  END LOOP;
  RETURN code;
END;
$$;