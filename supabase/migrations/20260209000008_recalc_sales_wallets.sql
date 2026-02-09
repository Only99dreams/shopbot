-- Recalculate seller wallet balances from payments and approved payouts

WITH earned AS (
  SELECT p.shop_id,
         COALESCE(SUM(p.seller_amount), 0) AS total_earned
  FROM public.payments p
  WHERE p.credited_to_seller = true
  GROUP BY p.shop_id
),
withdrawn AS (
  SELECT pr.shop_id,
         COALESCE(SUM(pr.amount), 0) AS total_withdrawn
  FROM public.payout_requests pr
  WHERE pr.status = 'approved'
    AND pr.payout_type = 'sales'
  GROUP BY pr.shop_id
)
UPDATE public.seller_wallets w
SET total_earned = COALESCE(e.total_earned, 0),
    total_withdrawn = COALESCE(x.total_withdrawn, 0),
    balance = GREATEST(COALESCE(e.total_earned, 0) - COALESCE(x.total_withdrawn, 0), 0)
FROM earned e
FULL OUTER JOIN withdrawn x ON x.shop_id = e.shop_id
WHERE w.shop_id = COALESCE(e.shop_id, x.shop_id);

-- Ensure any wallet without matched rows is still non-negative
UPDATE public.seller_wallets
SET balance = GREATEST(total_earned - total_withdrawn, 0)
WHERE balance < 0;
