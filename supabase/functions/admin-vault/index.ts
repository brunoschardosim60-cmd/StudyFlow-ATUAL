import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ----- Types mirrored from src/lib/studyData.ts (kept minimal) -----
type Subject = string;

interface StudySession {
  id: string;
  topicId: string | null;
  subject: Subject | null;
  start: string;
  end: string;
  durationMs: number;
}

interface StudyTopic {
  id: string;
  tema: string;
  materia: Subject;
  studyDate: string;
  notas: string;
  rating: number;
  revisions: unknown[];
  flashcards: unknown[];
  quizErrors: unknown[];
  quizAttempts: number;
  quizLastScore: number | null;
  skipWeekendsRevisions: boolean;
}

interface StudyStateSnapshot {
  topics: StudyTopic[];
  weekly: unknown[];
  sessions: StudySession[];
}

interface GamificationState {
  xp: number;
  level: number;
  streak: number;
  lastStudyDate: string | null;
  totalSessions: number;
  totalStudyMs: number;
  achievements: string[];
  dailyGoals?: unknown;
}

const DEFAULT_STATE: StudyStateSnapshot = { topics: [], weekly: [], sessions: [] };
const DEFAULT_GAMIFICATION: GamificationState = {
  xp: 0,
  level: 1,
  streak: 0,
  lastStudyDate: null,
  totalSessions: 0,
  totalStudyMs: 0,
  achievements: [],
};

const ALL_SUBJECTS = [
  "Matematica", "Portugues", "Fisica", "Quimica", "Biologia",
  "Historia", "Geografia", "Filosofia", "Sociologia", "Ingles", "Redacao",
];

function toLocalDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function summary(state: StudyStateSnapshot, gam: GamificationState) {
  const totalHours = Math.round(
    (state.sessions.reduce((s, x) => s + x.durationMs, 0) / 3_600_000) * 10
  ) / 10;
  return {
    topicsCount: state.topics.length,
    sessionsCount: state.sessions.length,
    totalHours,
    subjects: Array.from(new Set(state.topics.map((t) => t.materia))).sort(),
    streak: gam.streak,
    xp: gam.xp,
  };
}

async function loadState(admin: ReturnType<typeof createClient>, userId: string): Promise<StudyStateSnapshot> {
  const { data } = await admin
    .from("study_state")
    .select("topics, weekly_slots, sessions")
    .eq("user_id", userId)
    .maybeSingle();

  let topics = (data?.topics as StudyTopic[]) ?? [];
  let sessions = (data?.sessions as StudySession[]) ?? [];
  const weekly = (data?.weekly_slots as unknown[]) ?? [];

  // Fallback: ler das tabelas relacionais quando o snapshot agregado estiver vazio
  if (topics.length === 0) {
    const { data: rows } = await admin
      .from("study_topics")
      .select("*")
      .eq("user_id", userId);
    topics = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      tema: (r.tema as string) ?? "",
      materia: (r.materia as string) ?? "",
      studyDate: (r.study_date as string) ?? "",
      notas: (r.notas as string) ?? "",
      rating: (r.rating as number) ?? 0,
      revisions: (r.revisions as unknown[]) ?? [],
      flashcards: (r.flashcards as unknown[]) ?? [],
      quizErrors: (r.quiz_errors as unknown[]) ?? [],
      quizAttempts: (r.quiz_attempts as number) ?? 0,
      quizLastScore: (r.quiz_last_score as number | null) ?? null,
      skipWeekendsRevisions: (r.skip_weekends_revisions as boolean) ?? false,
    }));
  }

  if (sessions.length === 0) {
    const { data: rows } = await admin
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId);
    sessions = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      topicId: (r.topic_id as string | null) ?? null,
      subject: (r.subject as string | null) ?? null,
      start: (r.start_at as string) ?? "",
      end: (r.end_at as string) ?? (r.start_at as string) ?? "",
      durationMs: (r.duration_ms as number) ?? 0,
    }));
  }

  return { topics, weekly, sessions };
}

async function saveState(admin: ReturnType<typeof createClient>, userId: string, state: StudyStateSnapshot) {
  await admin.from("study_state").upsert({
    user_id: userId,
    topics: state.topics as unknown,
    weekly_slots: state.weekly as unknown,
    sessions: state.sessions as unknown,
    updated_at: new Date().toISOString(),
  });
}

async function loadGamification(admin: ReturnType<typeof createClient>, userId: string): Promise<GamificationState> {
  const { data } = await admin
    .from("gamification_profiles")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.state) return { ...DEFAULT_GAMIFICATION };
  return { ...DEFAULT_GAMIFICATION, ...(data.state as GamificationState) };
}

async function saveGamification(admin: ReturnType<typeof createClient>, userId: string, gam: GamificationState) {
  await admin.from("gamification_profiles").upsert({
    user_id: userId,
    state: gam as unknown,
    updated_at: new Date().toISOString(),
  });
}

function registerSession(gam: GamificationState, durationMs: number): GamificationState {
  const today = toLocalDateStr(new Date());
  const xpGain = Math.round((durationMs / 60_000) * 1); // 1 XP per minute
  const xp = gam.xp + xpGain;
  const level = Math.max(1, Math.floor(xp / 100) + 1);
  const isNewDay = gam.lastStudyDate !== today;
  return {
    ...gam,
    xp,
    level,
    totalSessions: gam.totalSessions + 1,
    totalStudyMs: gam.totalStudyMs + durationMs,
    lastStudyDate: today,
    streak: isNewDay ? gam.streak + 1 : gam.streak,
  };
}

async function logAction(
  admin: ReturnType<typeof createClient>,
  userId: string,
  adminId: string,
  actionType: string,
  note: string,
  before: unknown,
  after: unknown,
) {
  await admin.from("admin_action_logs").insert({
    user_id: userId,
    admin_id: adminId,
    action_type: actionType,
    note,
    before_state: before as never,
    after_state: after as never,
  });
}

async function createSnapshot(
  admin: ReturnType<typeof createClient>,
  userId: string,
  adminId: string,
  reason: string,
) {
  const [profile, state, gam] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    loadState(admin, userId),
    loadGamification(admin, userId),
  ]);
  await admin.from("admin_user_snapshots").insert({
    user_id: userId,
    created_by: adminId,
    reason,
    snapshot: {
      profile: {
        displayName: profile.data?.display_name ?? "",
        avatarUrl: profile.data?.avatar_url ?? null,
        isAdmin: profile.data?.is_admin ?? false,
      },
      state,
      gamification: gam,
    } as never,
  });
}

// ----- Action handlers -----
type Ctx = {
  admin: ReturnType<typeof createClient>;
  adminId: string;
  payload: Record<string, unknown>;
};

const handlers: Record<string, (ctx: Ctx) => Promise<unknown>> = {
  async list_users({ admin }) {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const { data: notebooks } = await admin.from("notebooks").select("user_id");
    const counts = new Map<string, number>();
    for (const n of notebooks ?? []) {
      counts.set(n.user_id, (counts.get(n.user_id) ?? 0) + 1);
    }

    const cards = await Promise.all(
      (profiles ?? []).map(async (p) => {
        const state = await loadState(admin, p.id);
        const totalHours = Math.round(
          (state.sessions.reduce((s, x) => s + x.durationMs, 0) / 3_600_000) * 10
        ) / 10;
        return {
          id: p.id,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          isAdmin: p.is_admin,
          updatedAt: p.updated_at,
          notebooksCount: counts.get(p.id) ?? 0,
          topicsCount: state.topics.length,
          totalHours,
          subjects: Array.from(new Set(state.topics.map((t) => t.materia))).sort(),
        };
      }),
    );
    return cards;
  },

  async load_workspace({ admin, payload }) {
    const userId = payload.userId as string;
    const [profile, state, gam, notebooks] = await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).single(),
      loadState(admin, userId),
      loadGamification(admin, userId),
      admin.from("notebooks").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    if (profile.error) throw profile.error;
    return {
      profile: profile.data,
      state,
      gamification: gam,
      notebooksCount: notebooks.count ?? 0,
    };
  },

  async list_snapshots({ admin, payload }) {
    const { data, error } = await admin
      .from("admin_user_snapshots")
      .select("*")
      .eq("user_id", payload.userId as string)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },

  async create_snapshot({ admin, adminId, payload }) {
    await createSnapshot(admin, payload.userId as string, adminId, (payload.reason as string) || "Snapshot manual do admin");
    return { success: true };
  },

  async update_profile({ admin, adminId, payload }) {
    const userId = payload.userId as string;
    const displayName = payload.displayName as string;
    const state = await loadState(admin, userId);
    const gam = await loadGamification(admin, userId);
    const before = summary(state, gam);
    const { error } = await admin.from("profiles").update({
      display_name: displayName,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (error) throw error;
    await logAction(admin, userId, adminId, "update_profile", `Display name ajustado para ${displayName}`, before, before);
    return { success: true };
  },

  async add_hours({ admin, adminId, payload }) {
    const userId = payload.userId as string;
    const hours = Number(payload.hours);
    const subject = (payload.subject ?? null) as string | null;
    const note = (payload.note as string) ?? "";
    const targetDate = (payload.targetDate as string) || new Date().toISOString().split("T")[0];
    const durationMs = Math.max(0, Math.round(hours * 3_600_000));
    if (durationMs <= 0) return { success: true };

    const state = await loadState(admin, userId);
    const gam = await loadGamification(admin, userId);
    const before = summary(state, gam);
    const startIso = `${targetDate}T12:00:00.000Z`;

    const nextState: StudyStateSnapshot = {
      ...state,
      sessions: [...state.sessions, {
        id: crypto.randomUUID(),
        topicId: null,
        subject,
        start: startIso,
        end: startIso,
        durationMs,
      }],
    };
    const nextGam = registerSession(gam, durationMs);

    await createSnapshot(admin, userId, adminId, `Backup antes do ajuste de horas: ${note || `${hours}h`}`);
    await saveState(admin, userId, nextState);
    await saveGamification(admin, userId, nextGam);
    await logAction(admin, userId, adminId, "add_hours", note || `Adicionadas ${hours}h em ${targetDate}`, before, summary(nextState, nextGam));
    return { success: true };
  },

  async add_topic({ admin, adminId, payload }) {
    const userId = payload.userId as string;
    const tema = payload.tema as string;
    const materia = payload.materia as string;
    const notas = (payload.notas as string) ?? "";

    const state = await loadState(admin, userId);
    const gam = await loadGamification(admin, userId);
    const before = summary(state, gam);

    const topic: StudyTopic = {
      id: crypto.randomUUID(),
      tema,
      materia,
      studyDate: toLocalDateStr(new Date()),
      notas,
      rating: 0,
      revisions: [],
      flashcards: [],
      quizErrors: [],
      quizAttempts: 0,
      quizLastScore: null,
      skipWeekendsRevisions: false,
    };
    const nextState = { ...state, topics: [...state.topics, topic] };

    await createSnapshot(admin, userId, adminId, `Backup antes de adicionar tema: ${tema}`);
    await saveState(admin, userId, nextState);
    await logAction(admin, userId, adminId, "add_topic", `Tema criado manualmente: ${tema}`, before, summary(nextState, gam));
    return { success: true };
  },

  async delete_topic({ admin, adminId, payload }) {
    const userId = payload.userId as string;
    const topicId = payload.topicId as string;
    const state = await loadState(admin, userId);
    const gam = await loadGamification(admin, userId);
    const before = summary(state, gam);
    const topic = state.topics.find((t) => t.id === topicId);
    const nextState = { ...state, topics: state.topics.filter((t) => t.id !== topicId) };
    await createSnapshot(admin, userId, adminId, `Backup antes de remover tema: ${topic?.tema ?? topicId}`);
    await saveState(admin, userId, nextState);
    await logAction(admin, userId, adminId, "delete_topic", `Tema removido: ${topic?.tema ?? topicId}`, before, summary(nextState, gam));
    return { success: true };
  },

  async delete_session({ admin, adminId, payload }) {
    const userId = payload.userId as string;
    const sessionId = payload.sessionId as string;
    const state = await loadState(admin, userId);
    const gam = await loadGamification(admin, userId);
    const before = summary(state, gam);
    const nextState = { ...state, sessions: state.sessions.filter((s) => s.id !== sessionId) };
    await createSnapshot(admin, userId, adminId, `Backup antes de remover sessão de estudo`);
    await saveState(admin, userId, nextState);
    await logAction(admin, userId, adminId, "delete_session", `Sessão removida: ${sessionId}`, before, summary(nextState, gam));
    return { success: true };
  },

  async restore_snapshot({ admin, adminId, payload }) {
    const snapshotId = payload.snapshotId as string;
    const { data, error } = await admin
      .from("admin_user_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .single();
    if (error) throw error;

    const snap = data.snapshot as {
      profile: { displayName: string; avatarUrl: string | null; isAdmin: boolean };
      state: StudyStateSnapshot;
      gamification: GamificationState;
    } | null;
    if (!snap?.profile || !snap.state || !snap.gamification) {
      throw new Error("Snapshot inválido para restauração.");
    }

    const userId = data.user_id;
    const currentState = await loadState(admin, userId);
    const currentGam = await loadGamification(admin, userId);
    const before = summary(currentState, currentGam);

    await saveState(admin, userId, snap.state);
    await saveGamification(admin, userId, snap.gamification);
    await admin.from("profiles").update({
      display_name: snap.profile.displayName,
      avatar_url: snap.profile.avatarUrl,
      is_admin: snap.profile.isAdmin,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);

    await logAction(admin, userId, adminId, "restore_snapshot", `Estado restaurado a partir do snapshot ${snapshotId}`, before, summary(snap.state, snap.gamification));
    return { success: true };
  },

  async delete_user({ admin, adminId, payload }) {
    const targetUserId = payload.userId as string;
    if (!targetUserId || targetUserId === adminId) {
      throw new Error("ID inválido ou tentativa de auto-exclusão");
    }
    const tables = [
      "flora_chat_messages", "flora_decisions", "gamification_profiles",
      "notebook_ai_activities", "notebook_page_state", "notebook_pages",
      "notebooks", "spaced_reviews", "student_onboarding", "student_performance",
      "study_sessions", "study_state", "study_topics", "user_actions",
      "weekly_slots", "admin_user_snapshots", "admin_action_logs",
    ];
    for (const table of tables) {
      await admin.from(table).delete().eq("user_id", targetUserId);
    }
    await admin.from("admin_action_logs").delete().eq("admin_id", targetUserId);
    await admin.from("admin_user_snapshots").delete().eq("created_by", targetUserId);
    await admin.from("profiles").delete().eq("id", targetUserId);
    const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);
    if (authError) {
      throw new Error("Dados removidos mas falha ao deletar conta auth: " + authError.message);
    }
    return { success: true };
  },

  async list_subjects() {
    return ALL_SUBJECTS;
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Sessão inválida" }, 401);
    const adminId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", adminId)
      .single();
    if (!profile?.is_admin) return json({ error: "Acesso negado" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const payload = (body.payload ?? {}) as Record<string, unknown>;

    const handler = handlers[action];
    if (!handler) return json({ error: `Ação desconhecida: ${action}` }, 400);

    const result = await handler({ admin, adminId, payload });
    return json({ data: result });
  } catch (err) {
    console.error("admin-vault error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
