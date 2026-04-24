import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  createTopic,
  type Flashcard,
  getDailyStudyHours,
  getLocalStudyStateSnapshot,
  getOverdueRevisions,
  getStudyHoursStats,
  getStudyMomentum,
  getStudyStats,
  getTodayRevisions,
  getUpcomingRevisions,
  loadSessions,
  loadTopics,
  loadWeekly,
  rescheduleTopicRevision,
  saveSessions,
  saveTopics,
  saveWeekly,
  type StudySession,
  type StudyTopic,
  type Subject,
  toggleTopicRevision,
  type WeeklySlot,
} from "@/lib/studyData";
import { addDaysLocal, moveToNextBusinessDay, toLocalDateStr } from "@/lib/dateUtils";
import {
  ensureDailyReset,
  getDefaultGamificationState,
  goalsCompleted,
  loadGamification,
  registerQuiz,
  registerRevision,
  registerStudySession,
  saveGamification,
} from "@/lib/gamification";
import {
  getGamificationSyncMode,
  loadGamificationForUser,
  saveGamificationForUser,
} from "@/lib/gamificationStore";
import {
  canRestoreLocalStudyState,
  getInitialRemoteStudyState,
  getStudySyncMode,
  hasCompletedInitialMerge,
  loadRemoteStudyState,
  markInitialMergeComplete,
  mergeStudyStates,
  restoreStudyStateFromLocal,
  saveRemoteStudyState,
} from "@/lib/studyStateStore";
import { reportError } from "@/lib/errorHandling";

type SyncStatus = "local" | "local_only" | "syncing" | "synced" | "error";

const REMOTE_HYDRATION_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);
}

export function useStudyDashboard() {
  const { user, loading: authLoading } = useAuth();
  const studySyncMode = getStudySyncMode();
  const gamificationSyncMode = getGamificationSyncMode();

  const [topics, setTopics] = useState<StudyTopic[]>(() => loadTopics());
  const [weekly, setWeekly] = useState<WeeklySlot[]>(() => loadWeekly());
  const [sessions, setSessions] = useState<StudySession[]>(() => loadSessions());
  const [gamification, setGamification] = useState(() => ensureDailyReset(loadGamification()));
  const [activeStudyTopicId, setActiveStudyTopicId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [canRestoreFromLocal, setCanRestoreFromLocal] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveGamificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    saveGamification(gamification);

    if (!user || gamificationSyncMode === "local_only") return;

    if (saveGamificationTimeoutRef.current) clearTimeout(saveGamificationTimeoutRef.current);
    saveGamificationTimeoutRef.current = setTimeout(() => {
      saveGamificationForUser(user.id, gamification).catch((error) => {
        reportError("Erro ao sincronizar gamificacao:", error, { devOnly: true });
      });
    }, 350);

    return () => {
      if (saveGamificationTimeoutRef.current) clearTimeout(saveGamificationTimeoutRef.current);
    };
  }, [gamification, gamificationSyncMode, hydrated, user]);

  useEffect(() => {
    let cancelled = false;

    const hydrateStudyState = async () => {
      if (authLoading) return;

      const localState = getLocalStudyStateSnapshot();

      if (!user) {
        if (cancelled) return;
        const defaultGamification = getDefaultGamificationState();
        setTopics([]);
        setWeekly(localState.weekly);
        setSessions([]);
        setGamification(ensureDailyReset(defaultGamification));
        setSyncStatus("local");
        setCanRestoreFromLocal(false);
        setHydrated(true);
        return;
      }

      if (studySyncMode === "local_only") {
        if (cancelled) return;
        setTopics(localState.topics);
        setWeekly(localState.weekly);
        setSessions(localState.sessions);
        setGamification(ensureDailyReset(loadGamification()));
        setSyncStatus("local_only");
        setCanRestoreFromLocal(false);
        setHydrated(true);
        return;
      }

      try {
        const remote = await withTimeout(
          loadRemoteStudyState(user.id),
          REMOTE_HYDRATION_TIMEOUT_MS,
          "Timeout ao carregar estado remoto",
        );
        let nextState = remote ?? getInitialRemoteStudyState();
        const initialMergeDone = hasCompletedInitialMerge(user.id);

        if (remote && !initialMergeDone) {
          nextState = mergeStudyStates(localState, remote);
          await saveRemoteStudyState(user.id, nextState);
          markInitialMergeComplete(user.id);
        }

        if (cancelled) return;

        // After initial merge is done, remote is the source of truth — update localStorage
        if (remote && initialMergeDone) {
          saveTopics(nextState.topics);
          saveWeekly(nextState.weekly);
          saveSessions(nextState.sessions);
        }

        setTopics(nextState.topics);
        setWeekly(nextState.weekly);
        setSessions(nextState.sessions);

        const remoteGamification =
          gamificationSyncMode === "remote"
            ? await withTimeout(
                loadGamificationForUser(user.id),
                REMOTE_HYDRATION_TIMEOUT_MS,
                "Timeout ao carregar gamificacao remota",
              )
            : ensureDailyReset(loadGamification());

        if (cancelled) return;

        setGamification(remoteGamification);
        setSyncStatus("synced");
        setCanRestoreFromLocal(false);
        setHydrated(true);

        if (!remote) {
          await saveRemoteStudyState(user.id, nextState);
          markInitialMergeComplete(user.id);
        }
      } catch (error) {
        reportError("Erro ao carregar estado de estudo remoto:", error, { devOnly: true });
        if (cancelled) return;
        setTopics(localState.topics);
        setWeekly(localState.weekly);
        setSessions(localState.sessions);
        setSyncStatus("error");
        setCanRestoreFromLocal(canRestoreLocalStudyState());
        setHydrated(true);
      }
    };

    void hydrateStudyState();

    return () => {
      cancelled = true;
    };
  }, [authLoading, gamificationSyncMode, studySyncMode, user]);

  // Realtime: listen for admin changes to study sessions/state
  useEffect(() => {
    if (!user || studySyncMode === "local_only") return;

    const studyStateChannel = supabase
      .channel(`study-state-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'study_state',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { topics?: unknown; weekly_slots?: unknown; sessions?: unknown };
          if (row.topics) setTopics(row.topics as StudyTopic[]);
          if (row.weekly_slots) setWeekly(row.weekly_slots as WeeklySlot[]);
          if (row.sessions) setSessions(row.sessions as StudySession[]);
          setSyncStatus("synced");
        }
      )
      .subscribe();

    const studySessionsChannel = supabase
      .channel(`study-sessions-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          // Only reload sessions — do NOT overwrite topics/weekly since
          // this event is often triggered by our own save and the snapshot
          // may still contain stale topic data (e.g. revision not yet toggled).
          try {
            const { data: rows } = await supabase
              .from("study_sessions")
              .select("*")
              .eq("user_id", user.id)
              .order("start_at", { ascending: true });
            if (!rows) return;
            const freshSessions = rows.map((r) => ({
              id: r.id,
              topicId: r.topic_id,
              subject: r.subject,
              start: r.start_at,
              end: r.end_at,
              durationMs: r.duration_ms,
            })) as StudySession[];
            setSessions(freshSessions);
            setSyncStatus("synced");
          } catch (error) {
            reportError("Erro ao recarregar sessoes em tempo real:", error, { devOnly: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studyStateChannel);
      supabase.removeChannel(studySessionsChannel);
    };
  }, [user, studySyncMode]);

  // Listen for Flora's daily goals update
  useEffect(() => {
    const handleGoalsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      setGamification((prev) => ({
        ...prev,
        dailyGoals: {
          studyMinutes: detail.studyMinutes ?? prev.dailyGoals.studyMinutes,
          revisions: detail.revisions ?? prev.dailyGoals.revisions,
          quizCount: detail.quizCount ?? prev.dailyGoals.quizCount,
        },
      }));
    };
    window.addEventListener("gamification-goals-updated", handleGoalsUpdated as EventListener);
    return () => window.removeEventListener("gamification-goals-updated", handleGoalsUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    saveTopics(topics);
    saveWeekly(weekly);
    saveSessions(sessions);

    if (!user) return;

    if (studySyncMode === "local_only") {
      setSyncStatus("local_only");
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSyncStatus("syncing");
    saveTimeoutRef.current = setTimeout(() => {
      saveRemoteStudyState(user.id, { topics, weekly, sessions })
        .then(() => {
          setSyncStatus("synced");
        })
        .catch((error) => {
          reportError("Erro ao sincronizar estado de estudo remoto:", error, { devOnly: true });
          setSyncStatus("error");
        });
    }, 350);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [hydrated, sessions, studySyncMode, topics, user, weekly]);

  const todayRevisions = getTodayRevisions(topics);
  const overdueRevisions = getOverdueRevisions(topics);
  const upcomingRevisions = getUpcomingRevisions(topics);
  const stats = getStudyStats(topics);
  const momentum = getStudyMomentum(topics, sessions);
  const hoursStats = getStudyHoursStats(sessions);
  const dailyData = getDailyStudyHours(sessions);
  const goalStatus = goalsCompleted(gamification);

  const activeTopic = topics.find((topic) => topic.id === activeStudyTopicId) ?? null;
  const recommendedTopic = (() => {
    const overdueTopic = overdueRevisions
      .map(({ topic }) => topic)
      .sort((a, b) => a.rating - b.rating)[0];
    if (overdueTopic) return overdueTopic;

    const todayTopic = todayRevisions
      .map(({ topic }) => topic)
      .sort((a, b) => a.rating - b.rating)[0];
    if (todayTopic) return todayTopic;

    return [...topics].sort((a, b) => a.rating - b.rating)[0] ?? null;
  })();

  const weakTopics = [...topics]
    .filter((topic) => {
      const hasRecentErrors = (topic.quizErrors?.length ?? 0) > 0;
      const hasLowRatedQuizHistory = (topic.quizAttempts ?? 0) > 0 && topic.rating > 0 && topic.rating <= 2;
      return hasRecentErrors || hasLowRatedQuizHistory;
    })
    .sort((a, b) => {
      const aWeight = (a.quizErrors?.length ?? 0) * 10 + (5 - a.rating);
      const bWeight = (b.quizErrors?.length ?? 0) * 10 + (5 - b.rating);
      return bWeight - aWeight;
    });

  const topicsWithoutNotes = topics.filter((topic) => !topic.notas.trim()).sort((a, b) => a.rating - b.rating);
  const topicsWithoutFlashcards = topics
    .filter((topic) => topic.flashcards.length === 0)
    .sort((a, b) => a.rating - b.rating);

  const handleSessionEnd = useCallback((session: StudySession) => {
    setSessions((prev) => [...prev, session]);
    setGamification((prev) => registerStudySession(prev, session.durationMs));
  }, []);

  const handleToggleRevision = useCallback((topicId: string, idx: number) => {
    let completedNow = false;

    setTopics((prev) =>
      prev.map((topic) => {
        if (topic.id !== topicId) return topic;

        const before = topic.revisions[idx]?.completed;
        const updated = toggleTopicRevision(topic, idx);
        const after = updated.revisions[idx]?.completed;

        if (!before && after) completedNow = true;
        return updated;
      }),
    );

    if (completedNow) {
      setGamification((prev) => registerRevision(prev));
    }
  }, []);

  const handleRatingChange = useCallback((topicId: string, rating: number) => {
    setTopics((prev) => prev.map((topic) => (topic.id === topicId ? { ...topic, rating } : topic)));
  }, []);

  const handleDelete = useCallback((topicId: string) => {
    setTopics((prev) => prev.filter((topic) => topic.id !== topicId));
    setActiveStudyTopicId((prev) => (prev === topicId ? null : prev));
  }, []);

  const handleStartStudy = useCallback((topic: StudyTopic) => {
    setActiveStudyTopicId(topic.id);
  }, []);

  const handleRescheduleOverdue = useCallback((topicId: string, revisionIndex: number) => {
    setTopics((prev) =>
      prev.map((topic) => {
        if (topic.id !== topicId) return topic;

        const baseTomorrow = addDaysLocal(toLocalDateStr(new Date()), 1);
        const nextDate = topic.skipWeekendsRevisions ? moveToNextBusinessDay(baseTomorrow) : baseTomorrow;

        return rescheduleTopicRevision(topic, revisionIndex, nextDate);
      }),
    );
  }, []);

  const handleAdd = useCallback((tema: string, materia: Subject, data: string, skipWeekends: boolean) => {
    setTopics((prev) => [...prev, createTopic(tema, materia, data, skipWeekends)]);
  }, []);

  const handleUpdateNotes = useCallback((topicId: string, notas: string) => {
    setTopics((prev) => prev.map((topic) => (topic.id === topicId ? { ...topic, notas } : topic)));
  }, []);

  const handleUpdateFlashcards = useCallback((topicId: string, flashcards: Flashcard[]) => {
    setTopics((prev) => prev.map((topic) => (topic.id === topicId ? { ...topic, flashcards } : topic)));
  }, []);

  const handleSaveQuizResult = useCallback((payload: { topicId: string; score: number; total: number; wrongQuestions: string[]; difficulty?: "facil" | "medio" | "dificil" }) => {
    const { topicId, score, total, wrongQuestions, difficulty } = payload;
    const normalized = total > 0 ? score / total : 0;

    setTopics((prev) => {
      const updated = prev.map((topic) => {
        if (topic.id !== topicId) return topic;

        const nextRating = Math.max(1, Math.min(5, Math.round(normalized * 5)));
        const nextErrors = [...(topic.quizErrors ?? []), ...wrongQuestions].slice(-12);

        return {
          ...topic,
          quizAttempts: (topic.quizAttempts ?? 0) + 1,
          quizLastScore: normalized,
          quizErrors: nextErrors,
          rating: topic.rating === 0 ? nextRating : Math.round((topic.rating + nextRating) / 2),
        };
      });

      // Force immediate sync to backend (don't rely on debounce)
      if (user && studySyncMode === "remote") {
        const currentWeekly = loadWeekly();
        const currentSessions = loadSessions();
        saveRemoteStudyState(user.id, { topics: updated, weekly: currentWeekly, sessions: currentSessions })
          .then(() => setSyncStatus("synced"))
          .catch((err) => reportError("Erro ao salvar quiz:", err, { devOnly: true }));
      }

      return updated;
    });

    setGamification((prev) => registerQuiz(prev, { difficulty, score, total }));
  }, [user, studySyncMode]);

  const handleRestoreFromLocal = useCallback(async () => {
    if (!user || studySyncMode === "local_only") return;

    setSyncStatus("syncing");
    const restored = await restoreStudyStateFromLocal(user.id);
    setTopics(restored.topics);
    setWeekly(restored.weekly);
    setSessions(restored.sessions);
    setCanRestoreFromLocal(false);
    setSyncStatus("synced");
  }, [studySyncMode, user]);

  return {
    topics,
    setTopics,
    weekly,
    sessions,
    hydrated,
    canRestoreFromLocal,
    studySyncMode,
    gamificationSyncMode,
    syncStatus,
    todayRevisions,
    overdueRevisions,
    upcomingRevisions,
    stats,
    momentum,
    hoursStats,
    dailyData,
    gamification,
    goalStatus,
    activeTopic,
    recommendedTopic,
    weakTopics,
    topicsWithoutNotes,
    topicsWithoutFlashcards,
    setWeekly,
    handleSessionEnd,
    handleToggleRevision,
    handleRatingChange,
    handleDelete,
    handleStartStudy,
    handleRescheduleOverdue,
    handleAdd,
    handleUpdateNotes,
    handleUpdateFlashcards,
    handleSaveQuizResult,
    handleRestoreFromLocal,
  };
}
