-- ============================================================================
-- Attempt log for the public product authenticity checker.
--
-- The checker is callable without an account, so it is rate limited per
-- hashed IP to protect the AI quota. Only a pseudonymous hash and the final
-- verdict are stored — never the photo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.authenticity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  verdict text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS authenticity_checks_ip_time_idx
  ON public.authenticity_checks (ip_hash, created_at DESC);

ALTER TABLE public.authenticity_checks ENABLE ROW LEVEL SECURITY;

-- No policies: only the service role (used by the edge function) may read or
-- write this table.
REVOKE ALL ON public.authenticity_checks FROM anon, authenticated;
