import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getMyTier, getMyQuota, type AITier } from "@/lib/aiUsage";

const TIER_LABEL: Record<AITier, string> = { free: "Free", pro: "Pro", pro_plus: "Pro+" };

/**
 * Mostra discreto o uso atual da Flora (chat/dia) e o tier.
 * Aparece só se restar pouca quota (<25%) ou estourou.
 */
export function FloraQuotaIndicator({ action = "chat" }: { action?: string }) {
  const [tier, setTier] = useState<AITier>("free");
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number; allowed: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [t, q] = await Promise.all([getMyTier(), getMyQuota(action)]);
      if (!mounted) return;
      setTier(t);
      if (q) setQuota({ used: q.used, limit: q.limit, remaining: q.remaining, allowed: q.allowed });
    })();
    return () => { mounted = false; };
  }, [action]);

  if (!quota) return null;
  const pct = quota.limit > 0 ? quota.used / quota.limit : 0;
  if (pct < 0.75) return null; // só mostra quando perto do limite

  const isOver = !quota.allowed;
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${isOver ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
      <Sparkles className="h-3 w-3" />
      <span>
        {isOver
          ? `Limite ${TIER_LABEL[tier]} atingido (${quota.used}/${quota.limit})`
          : `${quota.remaining} chamadas restantes hoje (${TIER_LABEL[tier]})`}
      </span>
    </div>
  );
}
