-- Public order tracking by order number (paid orders only)

CREATE OR REPLACE FUNCTION public.track_order_by_number(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'total', o.total,
    'status', o.status,
    'payment_status', o.payment_status,
    'created_at', o.created_at,
    'redemption_confirmed', o.redemption_confirmed,
    'shops', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'logo_url', s.logo_url
    ),
    'order_items', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price
        )
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  INTO result
  FROM public.orders o
  JOIN public.shops s ON s.id = o.shop_id
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  WHERE UPPER(TRIM(o.order_number)) = UPPER(TRIM(p_order_number))
  GROUP BY o.id, s.id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_order_by_number(text) TO anon, authenticated;
