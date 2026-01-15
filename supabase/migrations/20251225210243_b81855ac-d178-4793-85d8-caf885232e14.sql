-- Create storage buckets for product images and shop logos
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-logos', 'shop-logos', true);

-- RLS policies for product-images bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Shop owners can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Shop owners can update their product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Shop owners can delete their product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
);

-- RLS policies for shop-logos bucket
CREATE POLICY "Anyone can view shop logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-logos');

CREATE POLICY "Shop owners can upload their logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-logos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Shop owners can update their logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'shop-logos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Shop owners can delete their logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'shop-logos'
  AND auth.uid() IS NOT NULL
);

-- Add OTP table for WhatsApp verification
CREATE TABLE public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on OTP table
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Anyone can insert OTP (needed for registration)
CREATE POLICY "Anyone can create OTP"
ON public.otp_verifications FOR INSERT
WITH CHECK (true);

-- Anyone can read their own OTP by phone
CREATE POLICY "Anyone can verify OTP"
ON public.otp_verifications FOR SELECT
USING (true);

-- Cleanup old OTPs
CREATE POLICY "Anyone can delete expired OTPs"
ON public.otp_verifications FOR DELETE
USING (expires_at < now());

-- Add whatsapp_conversations table for Messages page
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view their conversations"
ON public.whatsapp_conversations FOR SELECT
USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shop owners can manage their conversations"
ON public.whatsapp_conversations FOR ALL
USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- Add whatsapp_messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view their messages"
ON public.whatsapp_messages FOR SELECT
USING (conversation_id IN (
  SELECT id FROM whatsapp_conversations 
  WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
));

CREATE POLICY "Shop owners can manage their messages"
ON public.whatsapp_messages FOR ALL
USING (conversation_id IN (
  SELECT id FROM whatsapp_conversations 
  WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())));