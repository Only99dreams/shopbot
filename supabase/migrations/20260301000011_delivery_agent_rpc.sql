-- Agent-facing delivery list with the order/customer context needed to deliver.
-- Customer contact details are hidden until the agent has accepted the job.

CREATE OR REPLACE FUNCTION public.get_agent_deliveries()
RETURNS TABLE (
  assignment_id uuid,
  order_id uuid,
  order_number text,
  status text,
  delivery_fee numeric,
  agent_earning numeric,
  state text,
  city text,
  customer_name text,
  customer_phone text,
  address text,
  item_count integer,
  items jsonb,
  created_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent public.delivery_agents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_agent
    FROM public.delivery_agents
   WHERE user_id = auth.uid()
     AND status = 'approved';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    da.id,
    o.id,
    o.order_number,
    da.status,
    da.delivery_fee,
    da.agent_earning,
    da.state,
    da.city,
    c.name,
    CASE WHEN da.agent_id = v_agent.id THEN c.phone ELSE NULL END,
    CASE WHEN da.agent_id = v_agent.id THEN o.notes ELSE NULL END,
    COALESCE((SELECT count(*)::int FROM public.order_items oi WHERE oi.order_id = o.id), 0),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('name', oi.product_name, 'quantity', oi.quantity))
         FROM public.order_items oi
        WHERE oi.order_id = o.id),
      '[]'::jsonb
    ),
    da.created_at,
    da.accepted_at,
    da.delivered_at
  FROM public.delivery_assignments da
  JOIN public.orders o ON o.id = da.order_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE da.agent_id = v_agent.id
     OR (
       da.status = 'open'
       AND lower(da.state) = lower(v_agent.state)
       AND (da.city = '' OR lower(da.city) = lower(v_agent.city))
     )
  ORDER BY
    CASE da.status WHEN 'open' THEN 0 WHEN 'accepted' THEN 1 WHEN 'picked_up' THEN 2 ELSE 3 END,
    da.created_at DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_deliveries() TO authenticated;
