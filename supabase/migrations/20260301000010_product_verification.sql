-- ============================================================================
-- NAFDAC Greenbook verification fields for products.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS nafdac_number text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_details jsonb,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

DO $$
BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_verification_status_check
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'flagged'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS products_nafdac_number_idx
  ON public.products (upper(nafdac_number));
CREATE INDEX IF NOT EXISTS products_verification_status_idx
  ON public.products (verification_status);

-- ---------------------------------------------------------------------------
-- Sellers may edit prices, stock, names, images, etc. but never the
-- verification outcome. Changing the NAFDAC number resets the result to
-- "pending" until the automated Greenbook lookup runs again.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_product_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.nafdac_number := NULLIF(upper(trim(COALESCE(NEW.nafdac_number, ''))), '');

  -- auth.uid() is NULL for service_role (the verification function), which is
  -- allowed to write verification fields.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verification_status := CASE
        WHEN NEW.nafdac_number IS NULL THEN 'unverified'
        ELSE 'pending'
      END;
      NEW.verification_details := NULL;
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    ELSE
      IF NEW.nafdac_number IS DISTINCT FROM OLD.nafdac_number THEN
        NEW.verification_status := CASE
          WHEN NEW.nafdac_number IS NULL THEN 'unverified'
          ELSE 'pending'
        END;
        NEW.verification_details := NULL;
        NEW.verified_at := NULL;
        NEW.verified_by := NULL;
      ELSE
        NEW.verification_status := OLD.verification_status;
        NEW.verification_details := OLD.verification_details;
        NEW.verified_at := OLD.verified_at;
        NEW.verified_by := OLD.verified_by;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_product_verification ON public.products;
CREATE TRIGGER guard_product_verification
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_verification();

-- Existing products with a NAFDAC number already typed into the description
-- stay "unverified" until the owner supplies the dedicated field.
