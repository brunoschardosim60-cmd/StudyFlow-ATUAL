import { supabase } from "@/integrations/supabase/client";

const DEFAULT_INTERVALS = [1, 3, 7, 15];

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Schedule spaced reviews for a topic at intervals (default: 1, 3, 7, 15 days).
 * Idempotent per (user_id, topic_id, scheduled_date).
 */
export async function scheduleSpacedReviews(
  userId: string,
  topicId: string,
  materia: string,
  intervals: number[] = DEFAULT_INTERVALS
): Promise<{ created: number; error?: string }> {
  if (!userId || !topicId) return { created: 0, error: "missing ids" };
  const today = new Date();

  const rows = intervals.map((days) => ({
    user_id: userId,
    topic_id: topicId,
    materia,
    interval_days: days,
    scheduled_date: addDays(today, days),
    completed: false,
  }));

  // Avoid duplicates: read existing for this topic and skip same scheduled_date
  const { data: existing } = await supabase
    .from("spaced_reviews")
    .select("scheduled_date")
    .eq("user_id", userId)
    .eq("topic_id", topicId);

  const existingDates = new Set((existing ?? []).map((r) => r.scheduled_date));
  const toInsert = rows.filter((r) => !existingDates.has(r.scheduled_date));
  if (toInsert.length === 0) return { created: 0 };

  const { error } = await supabase.from("spaced_reviews").insert(toInsert);
  if (error) return { created: 0, error: error.message };
  return { created: toInsert.length };
}
