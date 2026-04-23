
-- Security definer function to check if current user is admin (avoids recursive RLS on profiles)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
$$;

-- Admins can view ALL profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin_user());

-- Admins can update ALL profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin_user());

-- Admins can read all study_state
CREATE POLICY "Admins can read all study state"
ON public.study_state FOR SELECT
USING (public.is_admin_user());

-- Admins can update all study_state
CREATE POLICY "Admins can manage all study state"
ON public.study_state FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all study_topics
CREATE POLICY "Admins can manage all study topics"
ON public.study_topics FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all study_sessions
CREATE POLICY "Admins can manage all study sessions"
ON public.study_sessions FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all notebooks
CREATE POLICY "Admins can manage all notebooks"
ON public.notebooks FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all notebook_pages
CREATE POLICY "Admins can manage all notebook pages"
ON public.notebook_pages FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all weekly_slots
CREATE POLICY "Admins can manage all weekly slots"
ON public.weekly_slots FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all gamification_profiles
CREATE POLICY "Admins can manage all gamification"
ON public.gamification_profiles FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all spaced_reviews
CREATE POLICY "Admins can manage all spaced reviews"
ON public.spaced_reviews FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all student_performance
CREATE POLICY "Admins can manage all performance"
ON public.student_performance FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage all student_onboarding
CREATE POLICY "Admins can manage all onboarding"
ON public.student_onboarding FOR ALL
USING (public.is_admin_user());

-- Admins can read/manage flora data
CREATE POLICY "Admins can manage all flora messages"
ON public.flora_chat_messages FOR ALL
USING (public.is_admin_user());

CREATE POLICY "Admins can manage all flora decisions"
ON public.flora_decisions FOR ALL
USING (public.is_admin_user());
