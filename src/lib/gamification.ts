import { loadJsonStorage } from "@/lib/storage";

export interface DailyGoals {
  studyMinutes: number;
  revisions: number;
  quizCount: number;
}

export interface GamificationState {
  streak: number;
  lastStudyDate: string | null;
  xp: number;
  level: number;
  todayStudyMinutes: number;
  todayRevisions: number;
  todayQuizCount: number;
  dailyGoals: DailyGoals;
}

const STORAGE_KEY = "studyflow-gamification";
const DAILY_GOAL_BONUS_XP = 20;

export function getTodayLocalDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getYesterdayLocalDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultGamificationState(): GamificationState {
  return {
    streak: 0,
    lastStudyDate: null,
    xp: 0,
    level: 1,
    todayStudyMinutes: 0,
    todayRevisions: 0,
    todayQuizCount: 0,
    dailyGoals: {
      studyMinutes: 30,
      revisions: 5,
      quizCount: 1,
    },
  };
}

export function loadGamification(): GamificationState {
  if (typeof window === "undefined") return getDefaultGamificationState();

  const saved = loadJsonStorage<Partial<GamificationState>>(STORAGE_KEY);
  if (!saved) return getDefaultGamificationState();

  return {
    ...getDefaultGamificationState(),
    ...saved,
  };
}

export function saveGamification(state: GamificationState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function calculateLevel(xp: number) {
  return Math.floor(xp / 100) + 1;
}

export function ensureDailyReset(state: GamificationState): GamificationState {
  const today = getTodayLocalDate();
  const yesterday = getYesterdayLocalDate();

  if (state.lastStudyDate === today || state.lastStudyDate === null) {
    return state;
  }

  return {
    ...state,
    todayStudyMinutes: 0,
    todayRevisions: 0,
    todayQuizCount: 0,
    streak: state.lastStudyDate === yesterday ? state.streak : 0,
  };
}

export function goalsCompleted(state: GamificationState) {
  return {
    studyMinutes: state.todayStudyMinutes >= state.dailyGoals.studyMinutes,
    revisions: state.todayRevisions >= state.dailyGoals.revisions,
    quizCount: state.todayQuizCount >= state.dailyGoals.quizCount,
  };
}

function allGoalsDone(state: GamificationState) {
  const goals = goalsCompleted(state);
  return goals.studyMinutes && goals.revisions && goals.quizCount;
}

function applyGoalBonus(previous: GamificationState, next: GamificationState): GamificationState {
  const before = allGoalsDone(previous);
  const after = allGoalsDone(next);

  if (!before && after) {
    const nextXp = next.xp + DAILY_GOAL_BONUS_XP;
    return {
      ...next,
      xp: nextXp,
      level: calculateLevel(nextXp),
    };
  }

  return next;
}

function registerActivity(
  state: GamificationState,
  baseXp: number,
  mutateToday: (
    current: GamificationState
  ) => Pick<GamificationState, "todayStudyMinutes" | "todayRevisions" | "todayQuizCount">
): GamificationState {
  const today = getTodayLocalDate();
  const yesterday = getYesterdayLocalDate();

  let nextStreak = state.streak;
  if (state.lastStudyDate === yesterday) nextStreak += 1;
  else if (state.lastStudyDate !== today) nextStreak = 1;

  const nextXp = state.xp + baseXp;
  const counters = mutateToday(state);

  const nextState: GamificationState = {
    ...state,
    ...counters,
    streak: nextStreak,
    lastStudyDate: today,
    xp: nextXp,
    level: calculateLevel(nextXp),
  };

  return applyGoalBonus(state, nextState);
}

export function registerStudySession(
  state: GamificationState,
  durationMs: number
): GamificationState {
  // Use real elapsed minutes (no rounding-up). Sessions shorter than 60s
  // count as 0 minutes and give 0 XP — preventing 5s tests from looking like 1min.
  const minutes = Math.max(0, Math.floor(durationMs / 60000));
  if (minutes <= 0) return state;

  // XP scales with time: 1 XP per minute studied (was a flat +10 regardless of duration).
  const xpEarned = minutes;

  return registerActivity(state, xpEarned, (current) => ({
    todayStudyMinutes: current.todayStudyMinutes + minutes,
    todayRevisions: current.todayRevisions,
    todayQuizCount: current.todayQuizCount,
  }));
}

export function registerRevision(state: GamificationState): GamificationState {
  return registerActivity(state, 5, (current) => ({
    todayStudyMinutes: current.todayStudyMinutes,
    todayRevisions: current.todayRevisions + 1,
    todayQuizCount: current.todayQuizCount,
  }));
}

export type QuizDifficulty = "facil" | "medio" | "dificil";

export const QUIZ_BASE_XP = 10;
export const QUIZ_DIFFICULTY_MULTIPLIER: Record<QuizDifficulty, number> = {
  facil: 1,
  medio: 1.5,
  dificil: 2,
};

/** Calcula o XP final de um quiz: base × multiplicador × (acertos / total). */
export function calculateQuizXp(
  difficulty: QuizDifficulty,
  score: number,
  total: number
): number {
  if (total <= 0) return 0;
  const accuracyFactor = Math.max(0, Math.min(1, score / total));
  const multiplier = QUIZ_DIFFICULTY_MULTIPLIER[difficulty] ?? 1;
  return Math.round(QUIZ_BASE_XP * multiplier * accuracyFactor);
}

export function registerQuiz(
  state: GamificationState,
  options?: { difficulty?: QuizDifficulty; score?: number; total?: number }
): GamificationState {
  const difficulty = options?.difficulty ?? "medio";
  const score = options?.score ?? 1;
  const total = options?.total ?? 1;
  const xpEarned = calculateQuizXp(difficulty, score, total);

  return registerActivity(state, xpEarned, (current) => ({
    todayStudyMinutes: current.todayStudyMinutes,
    todayRevisions: current.todayRevisions,
    todayQuizCount: current.todayQuizCount + 1,
  }));
}
