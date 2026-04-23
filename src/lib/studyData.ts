import { daysDiffFromToday, isPastDateLocal, parseLocalDate, startOfLocalDay, toLocalDateStr } from "@/lib/dateUtils";
import { loadJsonStorage as loadSafeJsonStorage } from "@/lib/storage";


export type Subject =
  | "Matemática"
  | "Biologia"
  | "Química"
  | "Física"
  | "Português"
  | "História"
  | "Geografia"
  | "Inglês"
  | "Redação"
  | "Simulado";

export const SUBJECT_COLORS: Record<Subject, string> = {
  Matemática: "bg-subject-math",
  Biologia: "bg-subject-bio",
  Química: "bg-subject-chem",
  Física: "bg-subject-physics",
  Português: "bg-subject-portuguese",
  História: "bg-subject-history",
  Geografia: "bg-subject-geography",
  Inglês: "bg-subject-english",
  Redação: "bg-subject-redacao",
  Simulado: "bg-subject-simulado",
};

export const ALL_SUBJECTS: Subject[] = Object.keys(SUBJECT_COLORS) as Subject[];

export const REVISION_INTERVALS = [1, 3, 7, 14, 30, 60];

export interface Flashcard {
  id: string;
  frente: string;
  verso: string;
  /** Spaced repetition: days until next review */
  intervalDays?: number;
  /** Spaced repetition: next review date (ISO string) */
  nextReview?: string;
  /** Number of consecutive correct answers */
  streak?: number;
}

export type RevisionDifficulty = "easy" | "medium" | "hard";

export interface RevisionStep {
  scheduledDate: string | null;
  completed: boolean;
  completedAt?: string | null;
  difficulty?: RevisionDifficulty;
}

export interface StudyTopic {
  id: string;
  tema: string;
  materia: Subject;
  studyDate: string;
  skipWeekendsRevisions: boolean;
  revisions: RevisionStep[];
  rating: number;
  notas: string;
  flashcards: Flashcard[];
  quizAttempts: number;
  quizLastScore: number | null;
  quizErrors: string[];
  // Legacy fields kept temporarily for UI compatibility while migration completes.
  dataEstudo?: string;
  revisoes?: (string | null)[];
  concluidas?: boolean[];
}

export interface WeeklySlot {
  id: string;
  horario: string;
  dia: number;
  materia: Subject | null;
  descricao: string;
  concluido: boolean;
}

function moveToNextBusinessDay(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function buildRevisionSteps(dates: (string | null)[], completed: boolean[] = []): RevisionStep[] {
  return dates.map((scheduledDate, index) => ({
    scheduledDate,
    completed: Boolean(completed[index]),
    completedAt: null,
    difficulty: "medium",
  }));
}

function syncLegacyFields(topic: StudyTopic): StudyTopic {
  return {
    ...topic,
    dataEstudo: topic.studyDate,
    revisoes: topic.revisions.map((r) => r.scheduledDate),
    concluidas: topic.revisions.map((r) => r.completed),
  };
}

type TopicInput = Partial<StudyTopic> & {
  dataEstudo?: string;
  revisoes?: (string | null)[];
  concluidas?: boolean[];
};

type SessionInput = Partial<StudySession>;

function normalizeTopic(input: unknown): StudyTopic {
  const topic = typeof input === "object" && input !== null ? (input as TopicInput) : {};
  const studyDate = topic.studyDate ?? topic.dataEstudo ?? toLocalDateStr(new Date());
  const skipWeekendsRevisions = topic.skipWeekendsRevisions ?? false;

  const revisions: RevisionStep[] = Array.isArray(topic.revisions)
    ? topic.revisions.map((revision) => ({
        scheduledDate: revision?.scheduledDate ?? null,
        completed: Boolean(revision?.completed),
        completedAt: revision?.completedAt ?? null,
        difficulty: revision?.difficulty ?? "medium",
      }))
    : buildRevisionSteps(topic.revisoes ?? generateRevisionDates(studyDate, skipWeekendsRevisions), topic.concluidas ?? []);

  return syncLegacyFields({
    id: topic.id ?? crypto.randomUUID(),
    tema: topic.tema ?? "Tema",
    materia: topic.materia ?? "Matemática",
    studyDate,
    skipWeekendsRevisions,
    revisions,
    rating: topic.rating ?? 0,
    notas: topic.notas ?? "",
    flashcards: Array.isArray(topic.flashcards) ? topic.flashcards : [],
    quizAttempts: topic.quizAttempts ?? 0,
    quizLastScore: topic.quizLastScore ?? null,
    quizErrors: Array.isArray(topic.quizErrors) ? topic.quizErrors : [],
  });
}

export function generateRevisionDates(studyDate: string, skipWeekends = false): string[] {
  const base = parseLocalDate(studyDate);

  if (!skipWeekends) {
    return REVISION_INTERVALS.map((days) => {
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return toLocalDateStr(d);
    });
  }

  const result: string[] = [];
  let cursor = new Date(base);

  for (const days of REVISION_INTERVALS) {
    cursor.setDate(cursor.getDate() + days);
    cursor = moveToNextBusinessDay(cursor);
    result.push(toLocalDateStr(cursor));
  }

  return result;
}

export function createTopic(tema: string, materia: Subject, dataEstudo: string, skipWeekends = false): StudyTopic {
  const revisoes = generateRevisionDates(dataEstudo, skipWeekends);
  return syncLegacyFields({
    id: crypto.randomUUID(),
    tema,
    materia,
    studyDate: dataEstudo,
    skipWeekendsRevisions: skipWeekends,
    revisions: buildRevisionSteps(revisoes),
    rating: 0,
    notas: "",
    flashcards: [],
    quizAttempts: 0,
    quizLastScore: null,
    quizErrors: [],
  });
}

export function toggleTopicRevision(topic: StudyTopic, index: number): StudyTopic {
  const revisions = topic.revisions.map((revision, i) => {
    if (i !== index) return revision;
    const nextCompleted = !revision.completed;
    return {
      ...revision,
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : null,
    };
  });

  return syncLegacyFields({ ...topic, revisions });
}

export function rescheduleTopicRevision(topic: StudyTopic, index: number, nextDate: string): StudyTopic {
  const revisions = topic.revisions.map((revision, i) =>
    i === index
      ? { ...revision, scheduledDate: nextDate, completed: false, completedAt: null }
      : revision
  );
  return syncLegacyFields({ ...topic, revisions });
}

const LEGACY_STORAGE_KEY_TOPICS = "study-topics";
const LEGACY_STORAGE_KEY_WEEKLY = "study-weekly";
const LEGACY_STORAGE_KEY_SESSIONS = "study-sessions";
const STORAGE_KEY_TOPICS = "study-topics-v2";
const STORAGE_KEY_WEEKLY = "study-weekly-v2";
const STORAGE_KEY_SESSIONS = "study-sessions-v2";

function loadJsonStorage<T>(key: string): T | null {
  return loadSafeJsonStorage<T>(key);
}

function migrateLegacyStorage<T>(nextKey: string, legacyKey: string, normalize: (value: T) => T): T | null {
  try {
    const current = loadJsonStorage<T>(nextKey);
    if (current !== null) return normalize(current);

    const legacy = loadJsonStorage<T>(legacyKey);
    if (legacy === null) return null;

    const normalized = normalize(legacy);
    localStorage.setItem(nextKey, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

export function loadTopics(): StudyTopic[] {
  try {
    const migrated = migrateLegacyStorage<unknown[]>(STORAGE_KEY_TOPICS, LEGACY_STORAGE_KEY_TOPICS, (value) =>
      Array.isArray(value) ? value.map((topic) => normalizeTopic(topic)) : []
    );
    return (migrated ?? []) as StudyTopic[];
  } catch {
    return [];
  }
}

export function saveTopics(topics: StudyTopic[]) {
  localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));
}

export function loadWeekly(): WeeklySlot[] {
  try {
    const parsed = migrateLegacyStorage<WeeklySlot[]>(STORAGE_KEY_WEEKLY, LEGACY_STORAGE_KEY_WEEKLY, (value) =>
      Array.isArray(value) ? value : []
    );
    if (!parsed) return getDefaultWeekly();
    // Migrate: if missing 07:00 or 23:00 slots, regenerate
    const hours = new Set(parsed.map(s => s.horario));
    if (!hours.has("07:00") || !hours.has("23:00")) {
      const fresh = getDefaultWeekly();
      localStorage.setItem(STORAGE_KEY_WEEKLY, JSON.stringify(fresh));
      return fresh;
    }
    return parsed;
  } catch {
    return getDefaultWeekly();
  }
}

export function saveWeekly(slots: WeeklySlot[]) {
  localStorage.setItem(STORAGE_KEY_WEEKLY, JSON.stringify(slots));
}

export interface StudySession {
  id: string;
  topicId?: string | null;
  subject?: Subject | null;
  start: string; // ISO timestamp
  end: string | null;
  durationMs: number;
}

export interface StudyStateSnapshot {
  topics: StudyTopic[];
  weekly: WeeklySlot[];
  sessions: StudySession[];
}

export interface StudyMomentum {
  streakDays: number;
  todayMinutes: number;
  revisionsCompletedToday: number;
  weeklyProgressPercent: number;
  weeklyCompleted: number;
  weeklyTotal: number;
  lastActiveDaysAgo: number | null;
  comebackMode: boolean;
}

export function loadSessions(): StudySession[] {
  try {
    const migrated = migrateLegacyStorage<unknown[]>(STORAGE_KEY_SESSIONS, LEGACY_STORAGE_KEY_SESSIONS, (value) =>
      Array.isArray(value)
        ? value.map((session) => ({
            ...(typeof session === "object" && session !== null ? session : {}),
            topicId: (session as SessionInput).topicId ?? null,
            subject: (session as SessionInput).subject ?? null,
          }))
        : []
    );
    return (migrated ?? []) as StudySession[];
  } catch {
    return [];
  }
}

export function normalizeTopics(input: unknown): StudyTopic[] {
  return Array.isArray(input) ? input.map((topic) => normalizeTopic(topic)) : [];
}

export function createDefaultWeeklySlots(): WeeklySlot[] {
  const slots: WeeklySlot[] = [];
  const horarios: string[] = [];
  for (let h = 7; h <= 23; h++) {
    horarios.push(`${String(h).padStart(2, "0")}:00`);
  }
  for (const horario of horarios) {
    for (let dia = 0; dia < 7; dia++) {
    }
  }
  return slots;
}

export function normalizeWeeklySlots(input: unknown): WeeklySlot[] {
  if (!Array.isArray(input)) return createDefaultWeeklySlots();

  const parsed = input as WeeklySlot[];
  const existing = new Map<string, WeeklySlot>();
  for (const slot of parsed) {
    existing.set(`${slot.horario}|${slot.dia}`, slot);
  }

  // Ensure every hour/day combination exists, filling gaps with empty slots
  const horarios: string[] = [];
  for (let h = 7; h <= 23; h++) {
    horarios.push(`${String(h).padStart(2, "0")}:00`);
  }

  const result: WeeklySlot[] = [];
  for (const horario of horarios) {
    for (let dia = 0; dia < 7; dia++) {
      const key = `${horario}|${dia}`;
      result.push(existing.get(key) ?? { id: crypto.randomUUID(), horario, dia, materia: null, descricao: "", concluido: false });
    }
  }

  return result;
}

export function normalizeSessions(input: unknown): StudySession[] {
  if (!Array.isArray(input)) return [];

  return input.map((session) => {
    const normalized = typeof session === "object" && session !== null ? (session as SessionInput) : {};
    return {
      ...normalized,
      id: normalized.id ?? crypto.randomUUID(),
      start: normalized.start ?? new Date().toISOString(),
      end: normalized.end ?? null,
      durationMs: normalized.durationMs ?? 0,
      topicId: normalized.topicId ?? null,
      subject: normalized.subject ?? null,
    };
  });
}

export function getLocalStudyStateSnapshot(): StudyStateSnapshot {
  return {
    topics: loadTopics(),
    weekly: loadWeekly(),
    sessions: loadSessions(),
  };
}

export function saveSessions(sessions: StudySession[]) {
  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
}

export function getStudyHoursStats(sessions: StudySession[]) {
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const startOfWeek = startOfLocalDay(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday

  let todayMs = 0, weekMs = 0, monthMs = 0;
  for (const s of sessions) {
    if (!s.durationMs) continue;
    const sessionDate = new Date(s.start);
    const dateStr = toLocalDateStr(sessionDate);
    if (dateStr === todayStr) todayMs += s.durationMs;
    if (startOfLocalDay(sessionDate).getTime() >= startOfWeek.getTime()) weekMs += s.durationMs;
    if (sessionDate.getFullYear() === now.getFullYear() && sessionDate.getMonth() === now.getMonth()) {
      monthMs += s.durationMs;
    }
  }

  const toHours = (ms: number) => Math.round((ms / 3600000) * 10) / 10;
  return { todayHours: toHours(todayMs), weekHours: toHours(weekMs), monthHours: toHours(monthMs) };
}

export function getDailyStudyHours(sessions: StudySession[], days = 30) {
  const result: { date: string; label: string; hours: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDateStr(d);
    let totalMs = 0;
    for (const s of sessions) {
      if (!s.durationMs) continue;
      if (toLocalDateStr(new Date(s.start)) === dateStr) totalMs += s.durationMs;
    }
    const dd = d.getDate();
    result.push({
      date: dateStr,
      label: i === 0 ? "Hoje" : `${dd}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      hours: Math.round((totalMs / 3600000) * 10) / 10,
    });
  }
  return result;
}

function getDefaultWeekly(): WeeklySlot[] {
  return createDefaultWeeklySlots();
}

export function getTodayRevisions(topics: StudyTopic[]): { topic: StudyTopic; revisionIndex: number }[] {
  const today = toLocalDateStr(new Date());
  const results: { topic: StudyTopic; revisionIndex: number }[] = [];
  for (const topic of topics) {
    topic.revisions.forEach((revision, i) => {
      if (revision.scheduledDate === today && !revision.completed) {
        results.push({ topic, revisionIndex: i });
      }
    });
  }
  return results;
}

export function getOverdueRevisions(topics: StudyTopic[]): { topic: StudyTopic; revisionIndex: number; date: string }[] {
  const results: { topic: StudyTopic; revisionIndex: number; date: string }[] = [];
  for (const topic of topics) {
    topic.revisions.forEach((revision, i) => {
      if (revision.scheduledDate && !revision.completed && isPastDateLocal(revision.scheduledDate)) {
        results.push({ topic, revisionIndex: i, date: revision.scheduledDate });
      }
    });
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function getUpcomingRevisions(topics: StudyTopic[], days = 7): { topic: StudyTopic; revisionIndex: number; date: string }[] {
  const results: { topic: StudyTopic; revisionIndex: number; date: string }[] = [];
  for (const topic of topics) {
    topic.revisions.forEach((revision, i) => {
      if (!revision.scheduledDate || revision.completed) return;
      const diff = daysDiffFromToday(revision.scheduledDate);
      if (diff > 0 && diff <= days) {
        results.push({ topic, revisionIndex: i, date: revision.scheduledDate });
      }
    });
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function getWeekRevisionSummary(topics: StudyTopic[]) {
  const today = startOfLocalDay(new Date());
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

  const startStr = toLocalDateStr(startOfWeek);
  const endStr = toLocalDateStr(endOfWeek);

  let total = 0;
  let done = 0;
  const byDay: Record<string, { total: number; done: number }> = {};

  for (const topic of topics) {
    topic.revisions.forEach((revision) => {
      const date = revision.scheduledDate;
      if (date && date >= startStr && date <= endStr) {
        total++;
        if (revision.completed) done++;
        if (!byDay[date]) byDay[date] = { total: 0, done: 0 };
        byDay[date].total++;
        if (revision.completed) byDay[date].done++;
      }
    });
  }

  return { total, done, byDay, startStr, endStr };
}

export function getStudyStats(topics: StudyTopic[]) {
  const total = topics.length;
  const totalRevisoes = topics.reduce((sum, t) => sum + t.revisions.filter((r) => r.completed).length, 0);
  const totalPossivel = topics.reduce((sum, t) => sum + t.revisions.length, 0);
  const materias = new Set(topics.map(t => t.materia)).size;
  const overdue = getOverdueRevisions(topics).length;
  return { total, totalRevisoes, totalPossivel, materias, percentual: totalPossivel > 0 ? Math.round((totalRevisoes / totalPossivel) * 100) : 0, overdue };
}

function toActivityDates(topics: StudyTopic[], sessions: StudySession[]) {
  const dates = new Set<string>();

  for (const session of sessions) {
    dates.add(toLocalDateStr(new Date(session.start)));
  }

  for (const topic of topics) {
    for (const revision of topic.revisions) {
      if (!revision.completed) continue;
      if (revision.completedAt) {
        dates.add(toLocalDateStr(new Date(revision.completedAt)));
      } else if (revision.scheduledDate) {
        dates.add(revision.scheduledDate);
      }
    }
  }

  return dates;
}

function getStreakDays(activityDates: Set<string>) {
  let streak = 0;
  const cursor = startOfLocalDay(new Date());

  while (activityDates.has(toLocalDateStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getLastActiveDaysAgo(activityDates: Set<string>) {
  if (activityDates.size === 0) return null;

  const sorted = Array.from(activityDates).sort();
  const lastDate = sorted[sorted.length - 1];
  return Math.abs(Math.min(daysDiffFromToday(lastDate), 0));
}

export function getStudyMomentum(topics: StudyTopic[], sessions: StudySession[]): StudyMomentum {
  const todayStr = toLocalDateStr(new Date());
  const activityDates = toActivityDates(topics, sessions);
  const streakDays = getStreakDays(activityDates);
  const lastActiveDaysAgo = getLastActiveDaysAgo(activityDates);

  const todayMinutes = Math.round(
    sessions
      .filter((session) => toLocalDateStr(new Date(session.start)) === todayStr)
      .reduce((sum, session) => sum + session.durationMs, 0) / 60000
  );

  const revisionsCompletedToday = topics.reduce((sum, topic) => {
    return sum + topic.revisions.filter((revision) => {
      if (!revision.completed) return false;
      if (revision.completedAt) return toLocalDateStr(new Date(revision.completedAt)) === todayStr;
      return revision.scheduledDate === todayStr;
    }).length;
  }, 0);

  const topicIdsStudiedToday = new Set(
    sessions
      .filter((session) => toLocalDateStr(new Date(session.start)) === todayStr && session.topicId)
      .map((session) => session.topicId as string)
  );

  const weeklySummary = getWeekRevisionSummary(topics);
  const weeklyProgressPercent = weeklySummary.total > 0 ? Math.round((weeklySummary.done / weeklySummary.total) * 100) : 0;

  return {
    streakDays,
    todayMinutes,
    revisionsCompletedToday,
    weeklyProgressPercent,
    weeklyCompleted: weeklySummary.done,
    weeklyTotal: weeklySummary.total,
    lastActiveDaysAgo,
    comebackMode: (lastActiveDaysAgo ?? 0) >= 2,
  };
}
