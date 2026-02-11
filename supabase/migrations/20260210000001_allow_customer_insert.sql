-- Allow public customer creation and updates for guest checkout
-- This is required for .upsert() to work correctly on the customers table

CREATE POLICY "Anyone can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update customers"
ON public.customers
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can select customers"
ON public.customers
FOR SELECT
USING (true);

-- Allow public order creation for guest checkout
CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view orders"
ON public.orders
FOR SELECT
USING (true);

-- Allow public order items creation for guest checkout
CREATE POLICY "Anyone can create order items"
ON public.order_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view order items"
ON public.order_items
FOR SELECT
USING (true);
