-- Allow shop owners to insert/update their subscription

CREATE POLICY "Shop owners can insert their subscription" ON public.subscriptions
FOR INSERT
WITH CHECK (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);

CREATE POLICY "Shop owners can update their subscription" ON public.subscriptions
FOR UPDATE
USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
)
WITH CHECK (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);
