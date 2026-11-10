-- ============================================================================
-- Payout integrity and duplicate-proof protection.
--
-- Problems fixed here:
--   * payout_requests accepted any amount from the shop owner. The client
--     validates it, but a crafted request could ask for more than the wallet
--     holds, and an admin could then approve a real payout for it.
--   * approving a stale payout could overdraw a wallet after other payouts.
--   * a buyer could submit unlimited duplicate pending bank-transfer proofs
--     for the same order.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reject invalid payout requests at insert time
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_payout_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _available numeric := 0;
  _pending numeric := 0;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be greater than zero';
  END IF;

  IF NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'New payout requests must start as pending';
  END IF;

  IF NEW.payout_type = 'referral' THEN
    SELECT owner_id INTO _owner_id
      FROM public.shops
     WHERE id = NEW.shop_id;

    IF _owner_id IS NULL THEN
      RAISE EXCEPTION 'Shop not found';
    END IF;

    SELECT COALESCE(available_balance, 0) INTO _available
      FROM public.referral_codes
     WHERE user_id = _owner_id;
  ELSE
    SELECT COALESCE(balance, 0) INTO _available
      FROM public.seller_wallets
     WHERE shop_id = NEW.shop_id;
  END IF;

  -- Pending requests already reserve part of the balance.
  SELECT COALESCE(SUM(amount), 0) INTO _pending
    FROM public.payout_requests
   WHERE shop_id = NEW.shop_id
     AND payout_type = NEW.payout_type
     AND status = 'pending';

  IF NEW.amount > GREATEST(_available - _pending, 0) THEN
    RAISE EXCEPTION 'Payout amount exceeds available balance';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_payout_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_payout_request_trg ON public.payout_requests;
CREATE TRIGGER validate_payout_request_trg
  BEFORE INSERT ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_payout_request();

-- ---------------------------------------------------------------------------
-- 2. Re-check the balance when an admin approves a payout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_payout_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id UUID;
  _balance NUMERIC := 0;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status <> 'approved') THEN
    IF NEW.payout_type = 'referral' THEN
      SELECT owner_id INTO _owner_id
        FROM public.shops
       WHERE id = NEW.shop_id;

      IF _owner_id IS NULL THEN
        RAISE EXCEPTION 'Shop not found for payout';
      END IF;

      SELECT COALESCE(available_balance, 0) INTO _balance
        FROM public.referral_codes
       WHERE user_id = _owner_id
       FOR UPDATE;

      IF _balance < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient referral balance for this payout';
      END IF;

      UPDATE public.referral_codes
         SET available_balance = available_balance - NEW.amount,
             total_withdrawn = total_withdrawn + NEW.amount
       WHERE user_id = _owner_id;
    ELSE
      SELECT COALESCE(balance, 0) INTO _balance
        FROM public.seller_wallets
       WHERE shop_id = NEW.shop_id
       FOR UPDATE;

      IF _balance < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance for this payout';
      END IF;

      UPDATE public.seller_wallets
         SET balance = balance - NEW.amount,
             total_withdrawn = total_withdrawn + NEW.amount
       WHERE shop_id = NEW.shop_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.process_payout_request() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. At most one pending proof per reference
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS payment_proofs_one_pending_per_reference
  ON public.payment_proofs (payment_type, reference_id)
  WHERE status = 'pending';

NOTIFY pgrst, 'reload schema';
