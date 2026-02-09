-- Automatically deduct balances when payout requests are approved

CREATE OR REPLACE FUNCTION public.process_payout_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status <> 'approved') THEN
    IF NEW.payout_type = 'referral' THEN
      SELECT owner_id INTO _owner_id FROM public.shops WHERE id = NEW.shop_id;
      IF _owner_id IS NOT NULL THEN
        UPDATE public.referral_codes
        SET available_balance = available_balance - NEW.amount,
            total_withdrawn = total_withdrawn + NEW.amount
        WHERE user_id = _owner_id;
      END IF;
    ELSE
      UPDATE public.seller_wallets
      SET balance = balance - NEW.amount,
          total_withdrawn = total_withdrawn + NEW.amount
      WHERE shop_id = NEW.shop_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payout_request_approved ON public.payout_requests;
CREATE TRIGGER on_payout_request_approved
  AFTER UPDATE OF status ON public.payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.process_payout_request();
