-- Create seller_wallets table for tracking seller balances
CREATE TABLE public.seller_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create payout_requests table for seller withdrawal requests
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  bank_name text,
  account_number text,
  account_name text,
  admin_notes text,
  processed_at timestamp with time zone,
  processed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create payments table for Paystack transactions
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  paystack_reference text NOT NULL UNIQUE,
  paystack_transaction_id text,
  status text NOT NULL DEFAULT 'pending',
  platform_fee numeric DEFAULT 0,
  seller_amount numeric DEFAULT 0,
  credited_to_seller boolean DEFAULT false,
  credited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add bank details to shops table
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS account_name text;

-- Enable RLS on new tables
ALTER TABLE public.seller_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for seller_wallets
CREATE POLICY "Admins can manage all wallets" ON public.seller_wallets
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shop owners can view their wallet" ON public.seller_wallets
  FOR SELECT USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- RLS policies for payout_requests
CREATE POLICY "Admins can manage all payout requests" ON public.payout_requests
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shop owners can view their payout requests" ON public.payout_requests
  FOR SELECT USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shop owners can create payout requests" ON public.payout_requests
  FOR INSERT WITH CHECK (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- RLS policies for payments
CREATE POLICY "Admins can manage all payments" ON public.payments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shop owners can view their payments" ON public.payments
  FOR SELECT USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- Allow anyone to insert payments (for Paystack webhook)
CREATE POLICY "Anyone can create payments" ON public.payments
  FOR INSERT WITH CHECK (true);

-- Update trigger for seller_wallets
CREATE TRIGGER update_seller_wallets_updated_at
  BEFORE UPDATE ON public.seller_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create wallet for existing shops
INSERT INTO public.seller_wallets (shop_id)
SELECT id FROM public.shops
ON CONFLICT (shop_id) DO NOTHING;