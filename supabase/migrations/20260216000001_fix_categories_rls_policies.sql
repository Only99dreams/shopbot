-- Fix categories RLS policies to allow proper INSERT
-- The FOR ALL policy with a subquery against shops causes RLS recursion issues on INSERT.
-- Replace with explicit per-operation policies using the SECURITY DEFINER helper function.

-- Drop the existing broad policy
DROP POLICY IF EXISTS "Shop owners can manage categories" ON public.categories;

-- Create explicit policies using the SECURITY DEFINER function to avoid RLS recursion
CREATE POLICY "Shop owners can view own categories"
  ON public.categories FOR SELECT
  USING (shop_id = public.get_user_shop_id(auth.uid()));

CREATE POLICY "Shop owners can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (shop_id = public.get_user_shop_id(auth.uid()));

CREATE POLICY "Shop owners can update own categories"
  ON public.categories FOR UPDATE
  USING (shop_id = public.get_user_shop_id(auth.uid()));

CREATE POLICY "Shop owners can delete own categories"
  ON public.categories FOR DELETE
  USING (shop_id = public.get_user_shop_id(auth.uid()));
