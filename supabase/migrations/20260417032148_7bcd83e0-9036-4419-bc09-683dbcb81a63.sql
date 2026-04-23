CREATE TABLE public.essays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tema TEXT NOT NULL DEFAULT '',
  tipo_prova TEXT NOT NULL DEFAULT 'enem',
  texto TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho',
  competencia_1 INTEGER,
  competencia_2 INTEGER,
  competencia_3 INTEGER,
  competencia_4 INTEGER,
  competencia_5 INTEGER,
  nota_total INTEGER,
  feedback_geral TEXT NOT NULL DEFAULT '',
  feedback_competencias JSONB NOT NULL DEFAULT '{}'::jsonb,
  word_count INTEGER NOT NULL DEFAULT 0,
  line_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  corrected_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own essays"
ON public.essays
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all essays"
ON public.essays
FOR ALL
USING (public.is_admin_user());

CREATE INDEX idx_essays_user_created ON public.essays (user_id, created_at DESC);

CREATE TRIGGER update_essays_updated_at
BEFORE UPDATE ON public.essays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();