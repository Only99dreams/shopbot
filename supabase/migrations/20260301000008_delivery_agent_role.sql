-- Add the delivery_agent role.
--
-- PostgreSQL requires a new enum value to be committed before it can be used,
-- so this migration intentionally contains only the ALTER TYPE. The following
-- migration (20260301000009) uses the value.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery_agent';
