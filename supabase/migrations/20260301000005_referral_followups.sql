-- ============================================================================
-- Referral follow-ups:
--   * the Referrals page fell back to inserting a referral code client-side,
--     which is now blocked by RLS. Provide a safe server-side provisioner.
--   * referrers could not read the profiles of users they referred, so the
--     referral list showed blank names.
--   * the public "anyone can view referral codes" policy exposed every
--     referrer's user_id and balances; nothing in the app needs it anymore.
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view referral codes" ON public.referral_codes;

-- A referrer may read the profile of a user they successfully referred.
DROP POLICY IF EXISTS "Referrers can view referred profiles" ON public.profiles;
CREATE POLICY "Referrers can view referred profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.referrer_id = auth.uid()
        AND r.referred_id = profiles.id
    )
  );

-- Returns the caller's referral code, creating one if it is somehow missing.
CREATE OR REPLACE FUNCTION public.get_or_create_my_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _code text;
  _attempt integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT rc.code INTO _code
    FROM public.referral_codes rc
   WHERE rc.user_id = _uid;

  IF _code IS NOT NULL THEN
    RETURN _code;
  END IF;

  FOR _attempt IN 1..5 LOOP
    _code := UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text || _uid::text) FROM 1 FOR 8));

    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (_uid, _code);
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      -- Either the code collided or another request created the row first.
      SELECT rc.code INTO _code
        FROM public.referral_codes rc
       WHERE rc.user_id = _uid;
      IF _code IS NOT NULL THEN
        RETURN _code;
      END IF;
    END;
  END LOOP;

  RAISE EXCEPTION 'Unable to generate referral code';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_or_create_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_referral_code() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
