import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  createDefaultWeeklySlots,
  getLocalStudyStateSnapshot,
  normalizeSessions,
  normalizeTopics,
  normalizeWeeklySlots,
  saveSessions,
  saveTopics,
  saveWeekly,
  type StudyStateSnapshot,
  type StudyTopic,
  type WeeklySlot,
} from "@/lib/studyData";

const MERGE_MARKER_PREFIX = "studyflow.remote-merge.v1";
const STUDY_SYNC_UNAVAILABLE_KEY = "studyflow.sync.study-unavailable";
const REMOTE_STUDY_SYNC_ENABLED = true;
export type StudySyncMode = "remote" | "local_only";
let warnedStudySyncUnavailable = false;
let studySyncUnavailable = false;
// Clear stale unavailability marker from when sync was disabled
if (typeof window !== "undefined") {
  window.localStorage.removeItem(STUDY_SYNC_UNAVAILABLE_KEY);
}

function isLocalDev() {
  return typeof window !== "undefined" && window.location.hostname === "127.0.0.1";
}

function getMergeMarkerKey(userId: string) {
  return `${MERGE_MARKER_PREFIX}:${userId}`;
}

function isMissingStudySyncTable(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? String(error.code ?? "") : "";
  const maybeMessage = "message" in error ? String(error.message ?? "") : "";

  return (
    maybeCode === "PGRST205" &&
    (
      maybeMessage.includes("public.study_topics") ||
      maybeMessage.includes("public.weekly_slots") ||
      maybeMessage.includes("public.study_sessions") ||
      maybeMessage.includes("public.study_state")
    )
  );
}

function warnStudySyncUnavailableOnce() {
  if (warnedStudySyncUnavailable) return;
  warnedStudySyncUnavailable = true;
  studySyncUnavailable = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STUDY_SYNC_UNAVAILABLE_KEY, "true");
  }
  if (isLocalDev()) {
    console.warn("Study sync tables are not available in Supabase yet. Keeping study state local for now.");
  }
}

if (!REMOTE_STUDY_SYNC_ENABLED) {
  warnStudySyncUnavailableOnce();
}

export function getStudySyncMode(): StudySyncMode {
  return REMOTE_STUDY_SYNC_ENABLED && !studySyncUnavailable ? "remote" : "local_only";
}

export function hasCompletedInitialMerge(userId: string): boolean {
  return localStorage.getItem(getMergeMarkerKey(userId)) === "done";
}

export function markInitialMergeComplete(userId: string) {
  localStorage.setItem(getMergeMarkerKey(userId), "done");
}

function topicRichnessScore(topic: StudyTopic): number {
  const completedRevisions = topic.revisions.filter((revision) => revision.completed).length;
  const notesScore = topic.notas.trim().length;
  const flashcardsScore = topic.flashcards.length * 10;
  const ratingScore = topic.rating * 5;
  const quizScore = topic.quizAttempts * 8;
  return completedRevisions * 20 + notesScore + flashcardsScore + ratingScore + quizScore;
}

function mergeTopics(localTopics: StudyTopic[], remoteTopics: StudyTopic[]): StudyTopic[] {
  const merged = new Map<string, StudyTopic>();

  for (const topic of remoteTopics) {
    merged.set(topic.id, topic);
  }

  for (const topic of localTopics) {
    const existing = merged.get(topic.id);
    if (!existing) {
      merged.set(topic.id, topic);
      continue;
    }

    merged.set(topic.id, topicRichnessScore(topic) >= topicRichnessScore(existing) ? topic : existing);
  }

  return Array.from(merged.values()).sort((a, b) => a.studyDate.localeCompare(b.studyDate));
}

function countConfiguredWeeklySlots(slots: WeeklySlot[]): number {
  return slots.reduce((acc, slot) => {
    return slot.materia || slot.descricao.trim() || slot.concluido ? acc + 1 : acc;
  }, 0);
}

function mergeWeekly(localWeekly: WeeklySlot[], remoteWeekly: WeeklySlot[]): WeeklySlot[] {
  const localConfigured = countConfiguredWeeklySlots(localWeekly);
  const remoteConfigured = countConfiguredWeeklySlots(remoteWeekly);
  return localConfigured > remoteConfigured ? localWeekly : remoteWeekly;
}

function mergeSessions(localSessions: StudyStateSnapshot["sessions"], remoteSessions: StudyStateSnapshot["sessions"]) {
  const merged = new Map<string, StudyStateSnapshot["sessions"][number]>();
  [...remoteSessions, ...localSessions].forEach((session) => {
    merged.set(session.id, session);
  });

  return Array.from(merged.values()).sort((a, b) => a.start.localeCompare(b.start));
}

function getEmptyStudyState(): StudyStateSnapshot {
  return {
    topics: [],
    weekly: createDefaultWeeklySlots(),
    sessions: [],
  };
}

function hasMeaningfulLocalData(state: StudyStateSnapshot): boolean {
  return state.topics.length > 0 || state.sessions.length > 0 || countConfiguredWeeklySlots(state.weekly) > 0;
}

function toTopicRow(userId: string, topic: StudyTopic): TablesInsert<"study_topics"> {
  return {
    id: topic.id,
    user_id: userId,
    tema: topic.tema,
    materia: topic.materia,
    study_date: topic.studyDate,
    skip_weekends_revisions: topic.skipWeekendsRevisions,
    revisions: topic.revisions as unknown as TablesInsert<"study_topics">["revisions"],
    rating: topic.rating,
    notas: topic.notas,
    flashcards: topic.flashcards as unknown as TablesInsert<"study_topics">["flashcards"],
    quiz_attempts: topic.quizAttempts,
    quiz_last_score: topic.quizLastScore,
    quiz_errors: topic.quizErrors as unknown as TablesInsert<"study_topics">["quiz_errors"],
    updated_at: new Date().toISOString(),
  };
}

function toWeeklySlotRow(userId: string, slot: WeeklySlot): TablesInsert<"weekly_slots"> {
  return {
    id: slot.id,
    user_id: userId,
    horario: slot.horario,
    dia: slot.dia,
    materia: slot.materia,
    descricao: slot.descricao,
    concluido: slot.concluido,
    updated_at: new Date().toISOString(),
  };
}

function toSessionRow(userId: string, session: StudyStateSnapshot["sessions"][number]): TablesInsert<"study_sessions"> {
  return {
    id: session.id,
    user_id: userId,
    topic_id: session.topicId ?? null,
    subject: session.subject ?? null,
    start_at: session.start,
    end_at: session.end,
    duration_ms: session.durationMs,
  };
}

async function replaceUserRows(
  tableName: "study_topics" | "weekly_slots" | "study_sessions",
  userId: string,
  ids: string[],
  rows: Record<string, unknown>[]
) {
  const { data: existingRows, error: selectError } = await (supabase
    .from(tableName) as any)
    .select("id")
    .eq("user_id", userId);

  if (selectError) throw selectError;

  const existingIds = (existingRows ?? []).map((row: any) => row.id);
  const idsToDelete = existingIds.filter((id: string) => !ids.includes(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await (supabase
      .from(tableName) as any)
      .delete()
      .eq("user_id", userId)
      .in("id", idsToDelete);

    if (deleteError) throw deleteError;
  }

  if (rows.length > 0) {
    const { error: upsertError } = await (supabase.from(tableName) as any).upsert(rows);
    if (upsertError) throw upsertError;
  }
}

export async function loadRemoteStudyState(userId: string): Promise<StudyStateSnapshot | null> {
  if (!REMOTE_STUDY_SYNC_ENABLED) {
    return null;
  }

  if (studySyncUnavailable) {
    return null;
  }

  const [topicsResult, weeklyResult, sessionsResult, snapshotResult] = await Promise.all([
    supabase.from("study_topics").select("*").eq("user_id", userId).order("study_date", { ascending: true }),
    supabase.from("weekly_slots").select("*").eq("user_id", userId).order("dia", { ascending: true }).order("horario", { ascending: true }),
    supabase.from("study_sessions").select("*").eq("user_id", userId).order("start_at", { ascending: true }),
    supabase.from("study_state").select("topics, weekly_slots, sessions").eq("user_id", userId).maybeSingle(),
  ]);

  if (topicsResult.error && isMissingStudySyncTable(topicsResult.error)) {
    warnStudySyncUnavailableOnce();
    return null;
  }
  if (weeklyResult.error && isMissingStudySyncTable(weeklyResult.error)) {
    warnStudySyncUnavailableOnce();
    return null;
  }
  if (sessionsResult.error && isMissingStudySyncTable(sessionsResult.error)) {
    warnStudySyncUnavailableOnce();
    return null;
  }
  if (snapshotResult.error && isMissingStudySyncTable(snapshotResult.error)) {
    warnStudySyncUnavailableOnce();
    return null;
  }

  if (topicsResult.error) throw topicsResult.error;
  if (weeklyResult.error) throw weeklyResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (snapshotResult.error) throw snapshotResult.error;

  const relationalTopics = normalizeTopics(
    (topicsResult.data ?? []).map((row) => ({
      id: row.id,
      tema: row.tema,
      materia: row.materia,
      studyDate: row.study_date,
      skipWeekendsRevisions: row.skip_weekends_revisions,
      revisions: row.revisions,
      rating: row.rating,
      notas: row.notas,
      flashcards: row.flashcards,
      quizAttempts: row.quiz_attempts,
      quizLastScore: row.quiz_last_score,
      quizErrors: row.quiz_errors,
    }))
  );

  const relationalWeekly = normalizeWeeklySlots(
    (weeklyResult.data ?? []).map((row) => ({
      id: row.id,
      horario: row.horario,
      dia: row.dia,
      materia: row.materia,
      descricao: row.descricao,
      concluido: row.concluido,
    }))
  );

  const relationalSessions = normalizeSessions(
    (sessionsResult.data ?? []).map((row) => ({
      id: row.id,
      topicId: row.topic_id,
      subject: row.subject,
      start: row.start_at,
      end: row.end_at,
      durationMs: row.duration_ms,
    }))
  );

  const snapshotTopics = normalizeTopics(snapshotResult.data?.topics ?? []);
  const snapshotWeekly = normalizeWeeklySlots(snapshotResult.data?.weekly_slots ?? []);
  const snapshotSessions = normalizeSessions(snapshotResult.data?.sessions ?? []);

  const topics = mergeTopics(snapshotTopics, relationalTopics);
  const weekly = mergeWeekly(snapshotWeekly, relationalWeekly);
  const sessions = mergeSessions(snapshotSessions, relationalSessions);

  if (topics.length === 0 && sessions.length === 0 && countConfiguredWeeklySlots(weekly) === 0) {
    return null;
  }

  return { topics, weekly, sessions };
}

export async function saveRemoteStudyState(userId: string, state: StudyStateSnapshot): Promise<void> {
  if (!REMOTE_STUDY_SYNC_ENABLED) {
    return;
  }

  if (studySyncUnavailable) {
    return;
  }

  try {
    await Promise.all([
      replaceUserRows(
        "study_topics",
        userId,
        state.topics.map((topic) => topic.id),
        state.topics.map((topic) => toTopicRow(userId, topic))
      ),
      replaceUserRows(
        "weekly_slots",
        userId,
        state.weekly.map((slot) => slot.id),
        state.weekly.map((slot) => toWeeklySlotRow(userId, slot))
      ),
      replaceUserRows(
        "study_sessions",
        userId,
        state.sessions.map((session) => session.id),
        state.sessions.map((session) => toSessionRow(userId, session))
      ),
    ]);
  } catch (error) {
    if (isMissingStudySyncTable(error)) {
      warnStudySyncUnavailableOnce();
      return;
    }

    throw error;
  }
}

export async function saveTopicsForUser(userId: string | null | undefined, topics: StudyTopic[]): Promise<void> {
  saveTopics(topics);
  if (!userId) return;

  const localState = getLocalStudyStateSnapshot();
  const current = (await loadRemoteStudyState(userId)) ?? getEmptyStudyState();

  await saveRemoteStudyState(userId, {
    ...current,
    weekly: localState.weekly,
    sessions: localState.sessions,
    topics,
  });
}

export function getInitialRemoteStudyState(): StudyStateSnapshot {
  return getEmptyStudyState();
}

export function mergeStudyStates(local: StudyStateSnapshot, remote: StudyStateSnapshot): StudyStateSnapshot {
  return {
    topics: mergeTopics(local.topics, remote.topics),
    weekly: mergeWeekly(local.weekly, remote.weekly),
    sessions: mergeSessions(local.sessions, remote.sessions),
  };
}

export function canRestoreLocalStudyState(): boolean {
  return hasMeaningfulLocalData(getLocalStudyStateSnapshot());
}

export async function restoreStudyStateFromLocal(userId: string): Promise<StudyStateSnapshot> {
  const localState = getLocalStudyStateSnapshot();
  await saveRemoteStudyState(userId, localState);
  saveTopics(localState.topics);
  saveWeekly(localState.weekly);
  saveSessions(localState.sessions);
  markInitialMergeComplete(userId);
  return localState;
}
