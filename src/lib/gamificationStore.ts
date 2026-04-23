import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  ensureDailyReset,
  getDefaultGamificationState,
  loadGamification,
  saveGamification,
  type GamificationState,
} from "@/lib/gamification";

const GAMIFICATION_UNAVAILABLE_KEY = "studyflow.sync.gamification-unavailable";
const REMOTE_GAMIFICATION_SYNC_ENABLED = true;
export type GamificationSyncMode = "remote" | "local_only";
let warnedGamificationUnavailable = false;
let gamificationUnavailable = false;
// Clear stale unavailability marker from when sync was disabled
if (typeof window !== "undefined") {
  window.localStorage.removeItem(GAMIFICATION_UNAVAILABLE_KEY);
}

function isLocalDev() {
  return typeof window !== "undefined" && window.location.hostname === "127.0.0.1";
}

function normalizeGamification(input: unknown): GamificationState {
  const base = getDefaultGamificationState();
  if (!input || typeof input !== "object") return base;
  return {
    ...base,
    ...(input as Partial<GamificationState>),
    dailyGoals: {
      ...base.dailyGoals,
      ...((input as Partial<GamificationState>).dailyGoals ?? {}),
    },
  };
}

function isMissingGamificationTable(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? String(error.code ?? "") : "";
  const maybeMessage = "message" in error ? String(error.message ?? "") : "";

  return maybeCode === "PGRST205" && maybeMessage.includes("public.gamification_profiles");
}

function warnGamificationUnavailableOnce() {
  if (warnedGamificationUnavailable) return;
  warnedGamificationUnavailable = true;
  gamificationUnavailable = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GAMIFICATION_UNAVAILABLE_KEY, "true");
  }
  if (isLocalDev()) {
    console.warn("Gamification sync table is not available in Supabase yet. Keeping local state only.");
  }
}

if (!REMOTE_GAMIFICATION_SYNC_ENABLED) {
  warnGamificationUnavailableOnce();
}

export function getGamificationSyncMode(): GamificationSyncMode {
  return REMOTE_GAMIFICATION_SYNC_ENABLED && !gamificationUnavailable ? "remote" : "local_only";
}

export async function loadGamificationForUser(userId: string): Promise<GamificationState> {
  const local = ensureDailyReset(loadGamification());

  if (!REMOTE_GAMIFICATION_SYNC_ENABLED || gamificationUnavailable) {
    return local;
  }

  try {
    const { data, error } = await supabase
      .from("gamification_profiles")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && isMissingGamificationTable(error)) {
      warnGamificationUnavailableOnce();
      return local;
    }

    if (error) {
      // Network/timeout errors — use local, don't crash
      console.warn("[gamification] Remote load failed, using local:", error.message);
      return local;
    }

    if (!data?.state) {
      // First time: push local state to remote
      await saveGamificationForUser(userId, local).catch(() => {});
      return local;
    }

    const remote = ensureDailyReset(normalizeGamification(data.state));

    // Smart merge: always pick the highest values to avoid losing progress
    const merged: GamificationState = {
      ...remote,
      streak: Math.max(remote.streak, local.streak),
      xp: Math.max(remote.xp, local.xp),
      level: Math.max(remote.level, local.level),
      todayStudyMinutes: Math.max(remote.todayStudyMinutes, local.todayStudyMinutes),
      todayRevisions: Math.max(remote.todayRevisions, local.todayRevisions),
      todayQuizCount: Math.max(remote.todayQuizCount, local.todayQuizCount),
      lastStudyDate:
        remote.lastStudyDate && local.lastStudyDate
          ? remote.lastStudyDate > local.lastStudyDate
            ? remote.lastStudyDate
            : local.lastStudyDate
          : remote.lastStudyDate ?? local.lastStudyDate,
      dailyGoals: remote.dailyGoals,
    };

    // Persist merged state both locally and remotely
    saveGamification(merged);
    // Push merged state back to remote if it changed from what was fetched
    if (merged.xp !== remote.xp || merged.streak !== remote.streak ||
        merged.todayStudyMinutes !== remote.todayStudyMinutes) {
      await saveGamificationForUser(userId, merged).catch(() => {});
    }
    return merged;
  } catch (err) {
    console.warn("[gamification] Unexpected error, using local:", err);
    return local;
  }
}

export async function saveGamificationForUser(userId: string, state: GamificationState): Promise<void> {
  const payload = ensureDailyReset(state);
  saveGamification(payload);

  if (!REMOTE_GAMIFICATION_SYNC_ENABLED || gamificationUnavailable) {
    return;
  }

  try {
    const { error } = await supabase
      .from("gamification_profiles")
      .upsert(
        {
          user_id: userId,
          state: payload as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error && isMissingGamificationTable(error)) {
      warnGamificationUnavailableOnce();
      return;
    }

    if (error) {
      console.warn("[gamification] Remote save failed:", error.message);
    }
  } catch (err) {
    console.warn("[gamification] Unexpected save error:", err);
  }
}
