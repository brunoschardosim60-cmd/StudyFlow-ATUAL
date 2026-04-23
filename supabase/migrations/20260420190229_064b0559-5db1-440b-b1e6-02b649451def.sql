INSERT INTO public.tier_limits (tier, action_type, daily_limit) VALUES
  ('free', 'essay_correct', 5),
  ('pro', 'essay_correct', 30),
  ('pro_plus', 'essay_correct', 100),
  ('free', 'essay_theme', 10),
  ('pro', 'essay_theme', 50),
  ('pro_plus', 'essay_theme', 200)
ON CONFLICT DO NOTHING;