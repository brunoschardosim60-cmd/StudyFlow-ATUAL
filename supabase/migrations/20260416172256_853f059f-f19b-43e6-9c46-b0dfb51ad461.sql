ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS topic_id text;
CREATE INDEX IF NOT EXISTS idx_notebooks_topic_id ON public.notebooks(topic_id);