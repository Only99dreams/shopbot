-- Public shop metrics (rating + response time)

CREATE OR REPLACE FUNCTION public.get_shop_metrics(p_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_avg_rating numeric;
  v_rating_count int;
  v_avg_response_minutes numeric;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.shops WHERE id = p_shop_id;

  SELECT AVG(rating), COUNT(*)
  INTO v_avg_rating, v_rating_count
  FROM public.seller_ratings
  WHERE seller_id = v_owner_id;

  SELECT AVG(EXTRACT(EPOCH FROM (reply.created_at - first_buyer.created_at)) / 60)
  INTO v_avg_response_minutes
  FROM public.conversations c
  JOIN public.shops s ON s.id = c.shop_id
  JOIN LATERAL (
    SELECT m.created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.sender_id = c.buyer_id
    ORDER BY m.created_at ASC
    LIMIT 1
  ) first_buyer ON true
  JOIN LATERAL (
    SELECT m.created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.sender_id = s.owner_id
      AND m.created_at > first_buyer.created_at
    ORDER BY m.created_at ASC
    LIMIT 1
  ) reply ON true
  WHERE c.shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'avg_rating', v_avg_rating,
    'rating_count', v_rating_count,
    'avg_response_minutes', v_avg_response_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_metrics(uuid) TO anon, authenticated;