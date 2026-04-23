
CREATE TABLE public.study_goals (
  user_id UUID NOT NULL PRIMARY KEY,
  weekly_hours_target NUMERIC NOT NULL DEFAULT 10,
  monthly_hours_target NUMERIC NOT NULL DEFAULT 40,
  weekly_revisions_target INTEGER NOT NULL DEFAULT 15,
  weekly_topics_target INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals" ON public.study_goals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all goals" ON public.study_goals
  FOR ALL TO public
  USING (is_admin_user());
