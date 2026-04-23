-- ───────────────────────────────────────────────────────────────
-- 1. user_tiers
-- ───────────────────────────────────────────────────────────────
CREATE TABLE public.user_tiers (
  user_id UUID PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','pro_plus')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tier" ON public.user_tiers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all tiers" ON public.user_tiers
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER trg_user_tiers_updated
  BEFORE UPDATE ON public.user_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 2. tier_limits
-- ───────────────────────────────────────────────────────────────
CREATE TABLE public.tier_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL CHECK (tier IN ('free','pro','pro_plus')),
  action_type TEXT NOT NULL,
  daily_limit INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tier, action_type)
);
ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read limits" ON public.tier_limits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage limits" ON public.tier_limits
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER trg_tier_limits_updated
  BEFORE UPDATE ON public.tier_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed
INSERT INTO public.tier_limits (tier, action_type, daily_limit) VALUES
  ('free','generate_quiz',10),('free','generate_flashcards',10),('free','chat',30),('free','decide_next_topic',20),
  ('pro','generate_quiz',50),('pro','generate_flashcards',50),('pro','chat',200),('pro','decide_next_topic',100),
  ('pro_plus','generate_quiz',200),('pro_plus','generate_flashcards',200),('pro_plus','chat',1000),('pro_plus','decide_next_topic',500);

-- ───────────────────────────────────────────────────────────────
-- 3. ai_usage_logs
-- ───────────────────────────────────────────────────────────────
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(10,6) NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_usage_user_date ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX idx_ai_usage_action_date ON public.ai_usage_logs (action_type, created_at DESC);

CREATE POLICY "Users view own usage" ON public.ai_usage_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all usage" ON public.ai_usage_logs
  FOR SELECT USING (public.is_admin_user());
-- Inserts vão pelo edge function com service_role (bypassa RLS).

-- ───────────────────────────────────────────────────────────────
-- 4. Auto-criar tier free para novo usuário
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_tier()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_tiers (user_id, tier) VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_tier ON auth.users;
CREATE TRIGGER on_auth_user_created_tier
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tier();

-- Backfill para usuários existentes
INSERT INTO public.user_tiers (user_id, tier)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- 5. Função check_ai_quota
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_ai_quota(p_user_id UUID, p_action TEXT)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  SELECT tier INTO v_tier FROM public.user_tiers WHERE user_id = p_user_id;
  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  SELECT daily_limit INTO v_limit
  FROM public.tier_limits
  WHERE tier = v_tier AND action_type = p_action;
  IF v_limit IS NULL THEN v_limit := 0; END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.ai_usage_logs
  WHERE user_id = p_user_id
    AND action_type = p_action
    AND success = true
    AND created_at >= date_trunc('day', now());

  RETURN jsonb_build_object(
    'tier', v_tier,
    'limit', v_limit,
    'used', v_used,
    'remaining', GREATEST(v_limit - v_used, 0),
    'allowed', v_used < v_limit
  );
END;
$$;