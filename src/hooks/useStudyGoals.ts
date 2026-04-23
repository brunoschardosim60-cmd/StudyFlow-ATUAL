import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { reportError } from "@/lib/errorHandling";

export interface StudyGoals {
  weeklyHoursTarget: number;
  monthlyHoursTarget: number;
  weeklyRevisionsTarget: number;
  weeklyTopicsTarget: number;
}

const DEFAULT_GOALS: StudyGoals = {
  weeklyHoursTarget: 10,
  monthlyHoursTarget: 40,
  weeklyRevisionsTarget: 15,
  weeklyTopicsTarget: 5,
};

export function useStudyGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<StudyGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [hasGoals, setHasGoals] = useState(false);

  useEffect(() => {
    if (!user) {
      setGoals(DEFAULT_GOALS);
      setHasGoals(false);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("study_goals")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setGoals({
            weeklyHoursTarget: Number(data.weekly_hours_target),
            monthlyHoursTarget: Number(data.monthly_hours_target),
            weeklyRevisionsTarget: data.weekly_revisions_target,
            weeklyTopicsTarget: data.weekly_topics_target,
          });
          setHasGoals(true);
        }
      } catch (err) {
        reportError("Erro ao carregar metas:", err, { devOnly: true });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  const saveGoals = useCallback(async (next: StudyGoals) => {
    setGoals(next);
    if (!user) return;

    try {
      const { error } = await supabase
        .from("study_goals")
        .upsert({
          user_id: user.id,
          weekly_hours_target: next.weeklyHoursTarget,
          monthly_hours_target: next.monthlyHoursTarget,
          weekly_revisions_target: next.weeklyRevisionsTarget,
          weekly_topics_target: next.weeklyTopicsTarget,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;
      setHasGoals(true);
    } catch (err) {
      reportError("Erro ao salvar metas:", err, { devOnly: true });
    }
  }, [user]);

  return { goals, saveGoals, loading, hasGoals };
}
