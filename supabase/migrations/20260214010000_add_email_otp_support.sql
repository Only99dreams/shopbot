-- Add email column to otp_verifications for email-based OTP (password reset)
ALTER TABLE public.otp_verifications ADD COLUMN IF NOT EXISTS email TEXT;

-- Allow OTP lookup by email as well
CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON public.otp_verifications(email);

-- Add update policy for otp_verifications (needed for marking as verified)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update OTP' AND tablename = 'otp_verifications'
  ) THEN
    CREATE POLICY "Anyone can update OTP"
    ON public.otp_verifications FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
