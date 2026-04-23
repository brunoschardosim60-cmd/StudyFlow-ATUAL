const APP_STORAGE_VERSION = "v3";
const APP_VERSION_KEY = "studyflow.app-version";
const APP_STORAGE_PREFIXES = ["studyflow.", "studyflow-", "study-topics", "study-weekly", "study-sessions"];
const RECOVERY_SNAPSHOT_KEY = "studyflow.recovery-snapshot";
const RECOVERY_ATTEMPT_KEY = "studyflow.recovery-attempt";
const AUTH_STORAGE_PREFIX = "sb-";

const NON_JSON_STORAGE_KEYS = new Set([
  APP_VERSION_KEY,
  "studyflow.theme",
  "studyflow.activeTab",
  "studyflow.excludeWeekends",
  "studyflow.weekOffset",
  "studyflow.notebook.auto-solver",
]);

function hasStorageSignal(value: unknown) {
  if (typeof value !== "string") return false;

  const normalized = value.toLowerCase();
  return (
    normalized.includes("localstorage") ||
    normalized.includes("sessionstorage") ||
    normalized.includes("quotaexceeded") ||
    normalized.includes("storage") ||
    normalized.includes("indexeddb")
  );
}

function isAppStorageKey(key: string) {
  return APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function migrateAppStorageVersion(savedVersion: string | null) {
  if (typeof window === "undefined") return;

  // We no longer wipe user progress on version bumps. Keep valid data and only
  // prune obviously stale recovery/session markers.
  if (savedVersion == null) {
    repairCorruptedAppStorage();
    return;
  }

  window.sessionStorage.removeItem(RECOVERY_SNAPSHOT_KEY);
  window.sessionStorage.removeItem(RECOVERY_ATTEMPT_KEY);
  repairCorruptedAppStorage();
}

export function clearAppStorage() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || key === APP_VERSION_KEY) continue;
    if (isAppStorageKey(key)) keysToRemove.push(key);
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

export function initializeAppStorageVersion() {
  if (typeof window === "undefined") return;

  const savedVersion = window.localStorage.getItem(APP_VERSION_KEY);
  if (savedVersion === APP_STORAGE_VERSION) return;

  migrateAppStorageVersion(savedVersion);
  window.localStorage.setItem(APP_VERSION_KEY, APP_STORAGE_VERSION);
}

export function loadJsonStorage<T>(key: string, validate?: (value: unknown) => value is T): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      window.localStorage.removeItem(key);
      return null;
    }

    if (validate && !validate(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function loadStringStorage(key: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function loadNumberStorage(key: string): number | null {
  const value = loadStringStorage(key);
  if (value === null) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    window.localStorage.removeItem(key);
    return null;
  }

  return parsed;
}

export function clearAuthStorage() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (key.startsWith(AUTH_STORAGE_PREFIX)) keysToRemove.push(key);
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

export function createRecoverySnapshot() {
  if (typeof window === "undefined") return;

  const snapshot: Record<string, string> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !isAppStorageKey(key)) continue;
    const value = window.localStorage.getItem(key);
    if (value != null) snapshot[key] = value;
  }

  window.sessionStorage.setItem(RECOVERY_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function repairCorruptedAppStorage() {
  if (typeof window === "undefined") return { removedKeys: [] as string[] };

  const removedKeys: string[] = [];
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !isAppStorageKey(key) || NON_JSON_STORAGE_KEYS.has(key)) continue;
    keys.push(key);
  }

  keys.forEach((key) => {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return;

    try {
      JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(key);
      removedKeys.push(key);
    }
  });

  return { removedKeys };
}

export function runRecoveryMode(options?: { clearAuth?: boolean }) {
  if (typeof window === "undefined") return;

  createRecoverySnapshot();
  clearAppStorage();
  if (options?.clearAuth) clearAuthStorage();
  window.sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, String(Date.now()));
}

export function hasRecentRecoveryAttempt(windowMs = 15_000) {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(RECOVERY_ATTEMPT_KEY);
  if (!raw) return false;
  const value = Number(raw);
  return Number.isFinite(value) && Date.now() - value < windowMs;
}

export function isRecoverableStorageError(error: unknown) {
  if (!error) return false;

  if (error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "SecurityError" ||
      error.name === "InvalidStateError"
    );
  }

  if (error instanceof Error) {
    return hasStorageSignal(error.message) || hasStorageSignal(error.name);
  }

  return hasStorageSignal(String(error));
}
