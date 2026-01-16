-- Add location fields to shops table
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_shops_state ON public.shops(state);
CREATE INDEX IF NOT EXISTS idx_shops_city ON public.shops(city);

-- Add category field to products for marketplace filtering
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_type TEXT;
