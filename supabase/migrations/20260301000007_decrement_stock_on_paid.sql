-- ============================================================================
-- Inventory: decrement product stock exactly once when an order is paid.
--
-- create_order validates stock at checkout, but nothing ever reduced it, so
-- stock counts never moved. Doing this in a trigger covers every payment
-- path (Flutterwave, Paystack, webhook, manual bank-transfer approval) and
-- runs exactly once per order because it only fires on the unpaid -> paid
-- transition.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid' THEN

    UPDATE public.products p
       SET stock_quantity = GREATEST(p.stock_quantity - oi.quantity, 0)
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id
       AND oi.product_id = p.id
       AND p.stock_quantity IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.decrement_stock_on_order_paid() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS decrement_stock_on_order_paid_trg ON public.orders;
CREATE TRIGGER decrement_stock_on_order_paid_trg
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_order_paid();

NOTIFY pgrst, 'reload schema';
