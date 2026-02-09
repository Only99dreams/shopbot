-- Add referral wallet tracking fields
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS available_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn numeric NOT NULL DEFAULT 0;

-- Backfill available balance from total earnings
UPDATE public.referral_codes
SET available_balance = GREATEST(total_earnings - total_withdrawn, 0);

-- Add payout type to payout requests
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS payout_type text NOT NULL DEFAULT 'sales'
  CHECK (payout_type IN ('sales', 'referral'));

-- Backfill existing payout requests
UPDATE public.payout_requests
SET payout_type = 'sales'
WHERE payout_type IS NULL;
