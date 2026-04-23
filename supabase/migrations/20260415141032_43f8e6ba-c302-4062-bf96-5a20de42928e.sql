
-- Add folder and favorite to notebooks
ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS folder text DEFAULT NULL;
ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- Add template to notebook_pages
ALTER TABLE public.notebook_pages ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'blank';
