import { supabase } from "@/integrations/supabase/client";

export type AITier = "free" | "pro" | "pro_plus";

export interface TierLimit {
  id: string;
  tier: AITier;
  action_type: string;
  daily_limit: number;
}

export interface QuotaInfo {
  tier: AITier;
  limit: number;
  used: number;
  remaining: number;
  allowed: boolean;
}

/** Tier do usuário logado. */
export async function getMyTier(): Promise<AITier> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "free";
  const { data } = await supabase.from("user_tiers").select("tier").eq("user_id", user.id).maybeSingle();
  return ((data?.tier as AITier) ?? "free");
}

/** Quota atual de uma ação. */
export async function getMyQuota(action: string): Promise<QuotaInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("check_ai_quota", { p_user_id: user.id, p_action: action });
  if (error || !data) return null;
  return data as unknown as QuotaInfo;
}

/** Uso agregado dos últimos N dias do usuário. */
export async function getMyUsageSummary(days = 7) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("action_type, tokens_in, tokens_out, cost_estimate, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminListTiers(): Promise<Array<{ user_id: string; tier: AITier; updated_at: string }>> {
  const { data, error } = await supabase.from("user_tiers").select("user_id, tier, updated_at");
  if (error) throw error;
  return (data ?? []) as Array<{ user_id: string; tier: AITier; updated_at: string }>;
}

export async function adminSetUserTier(userId: string, tier: AITier): Promise<void> {
  const { error } = await supabase.from("user_tiers").upsert({ user_id: userId, tier });
  if (error) throw error;
}

export async function adminListLimits(): Promise<TierLimit[]> {
  const { data, error } = await supabase.from("tier_limits").select("*").order("tier").order("action_type");
  if (error) throw error;
  return (data ?? []) as TierLimit[];
}

export async function adminUpdateLimit(id: string, dailyLimit: number): Promise<void> {
  const { error } = await supabase.from("tier_limits").update({ daily_limit: dailyLimit }).eq("id", id);
  if (error) throw error;
}

export async function adminGetUsageByUser(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("user_id, action_type, tokens_in, tokens_out, cost_estimate, success, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}
