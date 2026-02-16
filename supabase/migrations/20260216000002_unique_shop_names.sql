-- Add unique constraint on shop names (case-insensitive)
-- This prevents two shops from having the same name

-- Create a unique index on LOWER(name) so "MyShop" and "myshop" are treated as the same
CREATE UNIQUE INDEX IF NOT EXISTS shops_name_unique_idx ON public.shops (LOWER(name));
