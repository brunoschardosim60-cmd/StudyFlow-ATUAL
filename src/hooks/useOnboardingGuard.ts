import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Redireciona para /onboarding se o usuário logado ainda não completou.
 * Admins pulam a verificação. Retorna `checked = true` quando seguro renderizar.
 */
export function useOnboardingGuard(user: User | null, isAdmin: boolean) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(!user);

  useEffect(() => {
    if (!user) { setChecked(true); return; }
    if (isAdmin) { setChecked(true); return; }
    let cancelled = false;
    supabase
      .from("student_onboarding")
      .select("completed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data || data.completed !== true) {
          navigate("/onboarding", { replace: true });
        } else {
          setChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [user, isAdmin, navigate]);

  return checked;
}
