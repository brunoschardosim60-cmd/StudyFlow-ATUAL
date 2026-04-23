// Helpers de quota + logging de uso da IA.
// Reutilizado por todas edge functions que chamam IA (flora-engine, essay-corrector, solve-math).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface QuotaResult {
  tier: "free" | "pro" | "pro_plus" | string;
  limit: number;
  used: number;
  remaining: number;
  allowed: boolean;
}

/** Verifica quota antes de chamar IA. Retorna allowed=false se estourou. */
export async function checkQuota(
  supabase: SupabaseClient,
  userId: string,
  actionType: string,
): Promise<QuotaResult> {
  try {
    const { data, error } = await supabase.rpc("check_ai_quota", {
      p_user_id: userId,
      p_action: actionType,
    });
    if (error || !data) {
      console.warn("[usage] check_ai_quota fallback:", error?.message);
      return { tier: "free", limit: 999, used: 0, remaining: 999, allowed: true };
    }
    return data as QuotaResult;
  } catch (e) {
    console.warn("[usage] check_ai_quota exception:", e);
    return { tier: "free", limit: 999, used: 0, remaining: 999, allowed: true };
  }
}

/** Log de uma chamada IA (sucesso ou falha). Roda fire-and-forget. */
export async function logAIUsage(
  supabase: SupabaseClient,
  params: {
    userId: string;
    actionType: string;
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    // Estimativa de custo bem grosseira — pode refinar depois por modelo.
    const totalTok = (params.tokensIn ?? 0) + (params.tokensOut ?? 0);
    const cost = (totalTok / 1_000_000) * 0.5; // ~$0.50/Mtok médio
    await supabase.from("ai_usage_logs").insert({
      user_id: params.userId,
      action_type: params.actionType,
      model: params.model ?? "",
      tokens_in: params.tokensIn ?? 0,
      tokens_out: params.tokensOut ?? 0,
      cost_estimate: cost,
      success: params.success,
      error_message: params.errorMessage ?? "",
      metadata: params.metadata ?? {},
    });
  } catch (e) {
    console.warn("[usage] logAIUsage failed:", e);
  }
}

/** Helper p/ criar resposta JSON 429 quando quota estourou. */
export function quotaExceededResponse(quota: QuotaResult, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "quota_exceeded",
      message: `Limite diário do plano ${quota.tier} atingido (${quota.used}/${quota.limit}). Tente novamente amanhã ou faça upgrade.`,
      quota,
    }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
