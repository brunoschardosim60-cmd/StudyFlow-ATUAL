import { loadJsonStorage } from "@/lib/storage";

const AI_ACTIVITY_STORAGE_KEY = "studyflow.ai-activities";
const MAX_AI_ACTIVITIES = 60;

export type AIActivityType = "summary" | "flashcards" | "quiz" | "topic" | "solver" | "sync" | "assistant" | "source";

export interface AIActivityItem {
  id: string;
  type: AIActivityType;
  title: string;
  detail: string;
  createdAt: string;
  notebookId?: string;
  pageId?: string;
  topicId?: string;
}

function isActivityItem(value: unknown): value is AIActivityItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.type === "string" &&
    typeof item.title === "string" &&
    typeof item.detail === "string" &&
    typeof item.createdAt === "string"
  );
}

function isActivityCollection(value: unknown): value is AIActivityItem[] {
  return Array.isArray(value) && value.every((item) => isActivityItem(item));
}

export function loadAIActivities(): AIActivityItem[] {
  return loadJsonStorage<AIActivityItem[]>(AI_ACTIVITY_STORAGE_KEY, isActivityCollection) ?? [];
}

export function saveAIActivities(items: AIActivityItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_ACTIVITY_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_AI_ACTIVITIES)));
}

export function recordAIActivity(input: Omit<AIActivityItem, "id" | "createdAt">): AIActivityItem[] {
  const nextItem: AIActivityItem = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const next = [nextItem, ...loadAIActivities()].slice(0, MAX_AI_ACTIVITIES);
  saveAIActivities(next);
  return next;
}

export function getNotebookAIActivities(notebookId: string, pageId?: string, limit = 8) {
  return loadAIActivities()
    .filter((item) => item.notebookId === notebookId && (!pageId || item.pageId === pageId))
    .slice(0, limit);
}
