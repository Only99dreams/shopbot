-- Recalculate referral balances from approved payout requests

WITH referral_withdrawals AS (
  SELECT s.owner_id AS user_id,
         COALESCE(SUM(pr.amount), 0) AS total_withdrawn
  FROM public.payout_requests pr
  JOIN public.shops s ON s.id = pr.shop_id
  WHERE pr.status = 'approved'
    AND pr.payout_type = 'referral'
  GROUP BY s.owner_id
)
UPDATE public.referral_codes rc
SET total_withdrawn = rw.total_withdrawn,
    available_balance = GREATEST(rc.total_earnings - rw.total_withdrawn, 0)
FROM referral_withdrawals rw
WHERE rc.user_id = rw.user_id;

-- Ensure users without approved referral payouts still have a valid available balance
UPDATE public.referral_codes
SET available_balance = GREATEST(total_earnings - total_withdrawn, 0)
WHERE available_balance IS NULL;
