INSERT INTO public.tier_limits (tier, action_type, daily_limit) VALUES
  ('free', 'solve_math', 10),
  ('pro', 'solve_math', 50),
  ('pro_plus', 'solve_math', 200)
ON CONFLICT DO NOTHING;