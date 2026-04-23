
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Study State (consolidated JSON)
CREATE TABLE public.study_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topics JSONB NOT NULL DEFAULT '[]',
  weekly_slots JSONB NOT NULL DEFAULT '[]',
  sessions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study state" ON public.study_state FOR ALL USING (auth.uid() = user_id);

-- Study Topics (individual rows)
CREATE TABLE public.study_topics (
  id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema TEXT NOT NULL,
  materia TEXT NOT NULL,
  study_date TEXT NOT NULL,
  skip_weekends_revisions BOOLEAN NOT NULL DEFAULT false,
  revisions JSONB NOT NULL DEFAULT '[]',
  rating INTEGER NOT NULL DEFAULT 0,
  notas TEXT NOT NULL DEFAULT '',
  flashcards JSONB NOT NULL DEFAULT '[]',
  quiz_attempts INTEGER NOT NULL DEFAULT 0,
  quiz_last_score INTEGER,
  quiz_errors JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own topics" ON public.study_topics FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_study_topics_ts BEFORE UPDATE ON public.study_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Study Sessions
CREATE TABLE public.study_sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT,
  subject TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON public.study_sessions FOR ALL USING (auth.uid() = user_id);

-- Weekly Slots
CREATE TABLE public.weekly_slots (
  id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horario TEXT NOT NULL,
  dia INTEGER NOT NULL,
  materia TEXT,
  descricao TEXT NOT NULL DEFAULT '',
  concluido BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own weekly slots" ON public.weekly_slots FOR ALL USING (auth.uid() = user_id);

-- Gamification Profiles
CREATE TABLE public.gamification_profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gamification" ON public.gamification_profiles FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_gamification_ts BEFORE UPDATE ON public.gamification_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Notebooks
CREATE TABLE public.notebooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Novo Caderno',
  subject TEXT,
  cover_color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notebooks" ON public.notebooks FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_notebooks_ts BEFORE UPDATE ON public.notebooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Notebook Pages
CREATE TABLE public.notebook_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL DEFAULT '',
  drawing_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notebook_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pages" ON public.notebook_pages FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_notebook_pages_ts BEFORE UPDATE ON public.notebook_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Notebook Page State
CREATE TABLE public.notebook_page_state (
  page_id UUID NOT NULL PRIMARY KEY REFERENCES public.notebook_pages(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_payload JSONB NOT NULL DEFAULT '{}',
  meta_payload JSONB NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notebook_page_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own page state" ON public.notebook_page_state FOR ALL USING (auth.uid() = user_id);

-- Notebook AI Activities
CREATE TABLE public.notebook_ai_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.notebook_pages(id) ON DELETE CASCADE,
  topic_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notebook_ai_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ai activities" ON public.notebook_ai_activities FOR ALL USING (auth.uid() = user_id);

-- Admin Action Logs
CREATE TABLE public.admin_action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage logs" ON public.admin_action_logs FOR ALL USING (auth.uid() = admin_id);

-- Admin User Snapshots
CREATE TABLE public.admin_user_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_user_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage snapshots" ON public.admin_user_snapshots FOR ALL USING (auth.uid() = created_by);

-- ===================== FLORA TABLES =====================

-- Student Onboarding
CREATE TABLE public.student_onboarding (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  objetivo TEXT NOT NULL DEFAULT '',
  tempo_disponivel_min INTEGER NOT NULL DEFAULT 60,
  materias_dificeis TEXT[] NOT NULL DEFAULT '{}',
  rotina TEXT NOT NULL DEFAULT '',
  meta_resultado TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.student_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own onboarding" ON public.student_onboarding FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_onboarding_ts BEFORE UPDATE ON public.student_onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Student Performance (per topic tracking)
CREATE TABLE public.student_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  materia TEXT NOT NULL,
  acertos INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
  erro_recorrente BOOLEAN NOT NULL DEFAULT false,
  prioridade INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_id)
);
ALTER TABLE public.student_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own performance" ON public.student_performance FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_performance_ts BEFORE UPDATE ON public.student_performance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- User Actions Log
CREATE TABLE public.user_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  topic_id TEXT,
  materia TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own actions" ON public.user_actions FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_user_actions_user ON public.user_actions(user_id, created_at DESC);

-- Flora Decisions
CREATE TABLE public.flora_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  recommendation JSONB NOT NULL DEFAULT '{}',
  accepted BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flora_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flora decisions" ON public.flora_decisions FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_flora_decisions_user ON public.flora_decisions(user_id, created_at DESC);

-- Spaced Reviews
CREATE TABLE public.spaced_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  materia TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  interval_days INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spaced_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reviews" ON public.spaced_reviews FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_spaced_reviews_user_date ON public.spaced_reviews(user_id, scheduled_date);
