-- Create payment_proofs table for storing payment receipts
CREATE TABLE public.payment_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'order')),
  reference_id UUID NOT NULL,
  shop_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  proof_image_url TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can create payment proofs"
ON public.payment_proofs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Shop owners can view their payment proofs"
ON public.payment_proofs
FOR SELECT
USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can manage all payment proofs"
ON public.payment_proofs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for payment proof images
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true);

-- Storage policies for payment proofs bucket
CREATE POLICY "Anyone can upload payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can view payment proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs');

CREATE POLICY "Admins can delete payment proofs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'payment-proofs' AND has_role(auth.uid(), 'admin'::app_role));

-- Insert default bank details in platform_settings
INSERT INTO public.platform_settings (key, value, description)
VALUES ('bank_details', '{"bank_name": "", "account_number": "", "account_name": ""}', 'Platform bank account details for receiving payments')
ON CONFLICT (key) DO NOTHING;