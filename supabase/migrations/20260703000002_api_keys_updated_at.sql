-- ============================================================
-- Add updated_at to api_keys + auto-update trigger
-- ============================================================

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Back-fill existing rows
UPDATE public.api_keys SET updated_at = created_at WHERE updated_at IS NULL;

-- Trigger: keep updated_at current on every row update
CREATE OR REPLACE FUNCTION public.set_api_keys_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_api_keys_updated_at();
