CREATE TABLE IF NOT EXISTS public.notebook_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE,
  is_public boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(notebook_id)
);

ALTER TABLE public.notebook_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_shares" ON public.notebook_shares
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "public_read_share" ON public.notebook_shares
  FOR SELECT USING (is_public = true AND (expires_at IS NULL OR expires_at > now()));

CREATE INDEX IF NOT EXISTS idx_notebook_shares_token ON public.notebook_shares(share_token);

-- Permitir leitura pública de notebooks compartilhados via share válido
CREATE POLICY "public_read_shared_notebooks" ON public.notebooks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notebook_shares s
      WHERE s.notebook_id = notebooks.id
        AND s.is_public = true
        AND (s.expires_at IS NULL OR s.expires_at > now())
    )
  );

CREATE POLICY "public_read_shared_pages" ON public.notebook_pages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notebook_shares s
      WHERE s.notebook_id = notebook_pages.notebook_id
        AND s.is_public = true
        AND (s.expires_at IS NULL OR s.expires_at > now())
    )
  );