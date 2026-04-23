import { supabase } from "@/integrations/supabase/client";
import type { AIActivityItem } from "@/lib/aiActivityStore";
import type { TablesInsert } from "@/integrations/supabase/types";

export interface NotebookStudyLink {
  subject: string;
  topicId: string | null;
  topicTitle: string;
}

export interface NotebookPageMeta {
  pinned: boolean;
  tags: string[];
}

export interface NotebookRemotePageState {
  pageId: string;
  link: NotebookStudyLink | null;
  meta: NotebookPageMeta;
  summary: string;
}

export interface NotebookSyncSnapshot {
  pageStates: NotebookRemotePageState[];
  activities: AIActivityItem[];
}

function isMissingNotebookSyncTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string; details?: string };
  const message = `${value.message ?? ""} ${value.details ?? ""}`.toLowerCase();
  return (
    value.code === "PGRST205" ||
    message.includes("notebook_page_state") ||
    message.includes("notebook_ai_activities") ||
    message.includes("could not find the table")
  );
}

function sanitizeMeta(input: unknown): NotebookPageMeta {
  if (!input || typeof input !== "object") return { pinned: false, tags: [] };
  const value = input as Record<string, unknown>;
  return {
    pinned: Boolean(value.pinned),
    tags: Array.isArray(value.tags) ? value.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
  };
}

function sanitizeLink(input: unknown): NotebookStudyLink | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const subject = typeof value.subject === "string" ? value.subject.trim() : "";
  const topicId = typeof value.topicId === "string" ? value.topicId : null;
  const topicTitle = typeof value.topicTitle === "string" ? value.topicTitle.trim() : "";

  if (!subject && !topicId && !topicTitle) return null;
  return {
    subject,
    topicId,
    topicTitle,
  };
}

function sanitizeActivity(row: {
  id: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
  notebook_id: string | null;
  page_id: string | null;
  topic_id: string | null;
}): AIActivityItem {
  return {
    id: row.id,
    type: row.type as AIActivityItem["type"],
    title: row.title,
    detail: row.detail,
    createdAt: row.created_at,
    notebookId: row.notebook_id ?? undefined,
    pageId: row.page_id ?? undefined,
    topicId: row.topic_id ?? undefined,
  };
}

function toActivityRow(userId: string, activity: AIActivityItem): TablesInsert<"notebook_ai_activities"> {
  return {
    id: activity.id,
    user_id: userId,
    notebook_id: activity.notebookId ?? null,
    page_id: activity.pageId ?? null,
    topic_id: activity.topicId ?? null,
    type: activity.type,
    title: activity.title,
    detail: activity.detail,
    created_at: activity.createdAt,
  };
}

export async function loadNotebookSyncSnapshot(userId: string, notebookId: string): Promise<NotebookSyncSnapshot> {
  const [pageStateResult, activitiesResult] = await Promise.all([
    supabase
      .from("notebook_page_state")
      .select("*")
      .eq("user_id", userId)
      .eq("notebook_id", notebookId),
    supabase
      .from("notebook_ai_activities")
      .select("*")
      .eq("user_id", userId)
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false }),
  ]);

  if (pageStateResult.error || activitiesResult.error) {
    const notebookSyncError = pageStateResult.error ?? activitiesResult.error;
    if (isMissingNotebookSyncTable(notebookSyncError)) {
      console.warn("Notebook sync tables not available yet. Falling back to local notebook state.");
      return { pageStates: [], activities: [] };
    }
    throw notebookSyncError;
  }

  return {
    pageStates: (pageStateResult.data ?? []).map((row) => ({
      pageId: row.page_id,
      link: sanitizeLink(row.link_payload),
      meta: sanitizeMeta(row.meta_payload),
      summary: typeof row.summary === "string" ? row.summary : "",
    })),
    activities: (activitiesResult.data ?? []).map(sanitizeActivity),
  };
}

export async function upsertNotebookPageState(
  userId: string,
  notebookId: string,
  pageId: string,
  state: {
    link?: NotebookStudyLink | null;
    meta?: NotebookPageMeta;
    summary?: string;
  },
): Promise<void> {
  const row: TablesInsert<"notebook_page_state"> = {
    page_id: pageId,
    notebook_id: notebookId,
    user_id: userId,
    link_payload: (state.link ?? null) as unknown as TablesInsert<"notebook_page_state">["link_payload"],
    meta_payload: (state.meta ?? { pinned: false, tags: [] }) as unknown as TablesInsert<"notebook_page_state">["meta_payload"],
    summary: state.summary ?? "",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("notebook_page_state").upsert(row);
  if (error) {
    if (isMissingNotebookSyncTable(error)) {
      console.warn("Notebook page sync skipped because remote table is not available yet.");
      return;
    }
    throw error;
  }
}

export async function upsertNotebookAIActivity(userId: string, activity: AIActivityItem): Promise<void> {
  const { error } = await supabase.from("notebook_ai_activities").upsert(toActivityRow(userId, activity));
  if (error) {
    if (isMissingNotebookSyncTable(error)) {
      console.warn("Notebook AI activity sync skipped because remote table is not available yet.");
      return;
    }
    throw error;
  }
}
