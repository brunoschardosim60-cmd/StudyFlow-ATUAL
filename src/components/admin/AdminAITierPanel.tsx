import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Loader2, Save, Crown, Zap, Star, Activity, DollarSign, MessageSquare, Hash } from "lucide-react";
import {
  adminListLimits,
  adminListTiers,
  adminUpdateLimit,
  adminSetUserTier,
  adminGetUsageByUser,
  type AITier,
  type TierLimit,
} from "@/lib/aiUsage";
import { reportError } from "@/lib/errorHandling";

interface AdminAITierPanelProps {
  users: Array<{ id: string; display_name: string; email?: string }>;
}

const TIER_META: Record<AITier, { label: string; icon: typeof Star; color: string }> = {
  free: { label: "Free", icon: Star, color: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", icon: Zap, color: "bg-primary/15 text-primary" },
  pro_plus: { label: "Pro+", icon: Crown, color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

const TIER_ORDER: AITier[] = ["free", "pro", "pro_plus"];

export function AdminAITierPanel({ users }: AdminAITierPanelProps) {
  const [tiers, setTiers] = useState<Record<string, AITier>>({});
  const [limits, setLimits] = useState<TierLimit[]>([]);
  const [usage, setUsage] = useState<Record<string, { calls: number; tokens: number; cost: number }>>({});
  const [usageRows, setUsageRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editLimits, setEditLimits] = useState<Record<string, number>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [tierRows, limitRows, usageRows] = await Promise.all([
        adminListTiers(),
        adminListLimits(),
        adminGetUsageByUser(7),
      ]);
      const tierMap: Record<string, AITier> = {};
      tierRows.forEach((r) => {
        tierMap[r.user_id] = r.tier;
      });
      setTiers(tierMap);
      setLimits(limitRows);
      setEditLimits(Object.fromEntries(limitRows.map((l) => [l.id, l.daily_limit])));

      const agg: Record<string, { calls: number; tokens: number; cost: number }> = {};
      usageRows.forEach((r: any) => {
        if (!agg[r.user_id]) agg[r.user_id] = { calls: 0, tokens: 0, cost: 0 };
        agg[r.user_id].calls += 1;
        agg[r.user_id].tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
        agg[r.user_id].cost += Number(r.cost_estimate ?? 0);
      });
      setUsage(agg);
      setUsageRows(usageRows);
    } catch (error) {
      reportError("admin tiers load", error, { devOnly: true });
      toast.error("Falha ao carregar tiers e uso");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetTier(userId: string, tier: AITier) {
    setSaving(userId);
    try {
      await adminSetUserTier(userId, tier);
      setTiers((prev) => ({ ...prev, [userId]: tier }));
      toast.success(`Tier atualizado para ${TIER_META[tier].label}`);
    } catch {
      toast.error("Falha ao atualizar tier");
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveAllLimits() {
    const updates = limits
      .map((limit) => ({
        id: limit.id,
        newLimit: editLimits[limit.id] ?? limit.daily_limit,
      }))
      .filter((item) => item.newLimit >= 0)
      .filter((item) => {
        const current = limits.find((limit) => limit.id === item.id);
        return current && item.newLimit !== current.daily_limit;
      });

    if (updates.length === 0) return;

    setSaving("limits-all");
    try {
      await Promise.all(updates.map((item) => adminUpdateLimit(item.id, item.newLimit)));
      const updatesMap = new Map(updates.map((item) => [item.id, item.newLimit]));
      setLimits((prev) =>
        prev.map((limit) => {
          const nextLimit = updatesMap.get(limit.id);
          return nextLimit === undefined ? limit : { ...limit, daily_limit: nextLimit };
        })
      );
      toast.success("Limites atualizados");
    } catch {
      toast.error("Falha ao salvar limites");
    } finally {
      setSaving(null);
    }
  }

  // Daily chart data — must be before early return (hooks rule)
  const dailyChartData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dayMap[d.toISOString().slice(0, 10)] = 0;
    }
    usageRows.forEach((r: any) => {
      const day = (r.created_at as string).slice(0, 10);
      if (day in dayMap) dayMap[day] += 1;
    });
    return Object.entries(dayMap).map(([date, calls]) => ({
      date,
      label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      calls,
    }));
  }, [usageRows]);

  const chartConfig: ChartConfig = {
    calls: { label: "Chamadas", color: "hsl(var(--primary))" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  const ranking = Object.entries(usage)
    .map(([userId, u]) => ({
      userId,
      ...u,
      name: users.find((x) => x.id === userId)?.display_name || userId.slice(0, 8),
      tier: tiers[userId] ?? "free",
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 20);

  const actionBreakdown = usageRows.reduce<Record<string, { calls: number; tokens: number; cost: number }>>((acc, r: any) => {
    const key = r.action_type ?? "unknown";
    if (!acc[key]) acc[key] = { calls: 0, tokens: 0, cost: 0 };
    acc[key].calls += 1;
    acc[key].tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
    acc[key].cost += Number(r.cost_estimate ?? 0);
    return acc;
  }, {});

  const totalStats = Object.values(actionBreakdown).reduce<{ calls: number; tokens: number; cost: number }>(
    (t, a) => ({ calls: t.calls + a.calls, tokens: t.tokens + a.tokens, cost: t.cost + a.cost }),
    { calls: 0, tokens: 0, cost: 0 },
  );

  const actionTypes = Array.from(new Set(limits.map((limit) => limit.action_type)));
  const hasDirtyLimits = limits.some((limit) => (editLimits[limit.id] ?? limit.daily_limit) !== limit.daily_limit);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        {[
          { icon: MessageSquare, label: "Chamadas", value: String(totalStats.calls) },
          { icon: Hash, label: "Tokens", value: `${(totalStats.tokens / 1000).toFixed(1)}k` },
          { icon: DollarSign, label: "Custo", value: `$${totalStats.cost.toFixed(3)}` },
          { icon: Activity, label: "Usuários", value: String(Object.keys(usage).length) },
        ].map((kpi) => (
          <Card key={kpi.label} className="flex-1 min-w-[120px] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-0.5">
              <kpi.icon className="h-3 w-3 shrink-0" /> {kpi.label}
            </div>
            <p className="text-xl font-semibold tabular-nums">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1 text-xs">Visão geral</TabsTrigger>
          <TabsTrigger value="limits" className="flex-1 text-xs">Limites</TabsTrigger>
          <TabsTrigger value="users" className="flex-1 text-xs">Usuários</TabsTrigger>
        </TabsList>

        {/* ─── VISÃO GERAL ─── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Gráfico de barras */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Chamadas por dia (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyChartData.every((d) => d.calls === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem chamadas nos últimos 7 dias.</p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <BarChart data={dailyChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="calls" fill="var(--color-calls)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Consumo por ação (7d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(actionBreakdown).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Sem chamadas IA nos últimos 7 dias.</p>
              ) : (
                <>
                  {Object.entries(actionBreakdown)
                    .sort(([, a], [, b]) => b.calls - a.calls)
                    .map(([action, stats]) => (
                      <div key={action} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="capitalize text-xs">{action.replace(/_/g, " ")}</Badge>
                          <span className="text-sm font-medium tabular-nums">{stats.calls} chamadas</span>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="tabular-nums">{(stats.tokens / 1000).toFixed(1)}k tokens</span>
                          <span className="tabular-nums">${stats.cost.toFixed(3)}</span>
                        </div>
                      </div>
                    ))}
                  <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between font-medium text-sm">
                    <span>Total</span>
                    <div className="flex gap-4 text-xs tabular-nums">
                      <span>{totalStats.calls} chamadas</span>
                      <span>{(totalStats.tokens / 1000).toFixed(1)}k tok</span>
                      <span>${totalStats.cost.toFixed(3)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Top usuários (7d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ranking.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Sem chamadas IA nos últimos 7 dias.</p>
              ) : (
                ranking.map((r, i) => {
                  const Meta = TIER_META[r.tier as AITier];
                  const Icon = Meta.icon;
                  return (
                    <div key={r.userId} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-5">#{i + 1}</span>
                        <span className="flex-1 truncate text-sm font-medium">{r.name}</span>
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${Meta.color}`}>
                          <Icon className="h-3 w-3" /> {Meta.label}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1 pl-7">
                        <span className="tabular-nums">{r.calls} chamadas</span>
                        <span className="tabular-nums">{(r.tokens / 1000).toFixed(1)}k tok</span>
                        <span className="tabular-nums">${r.cost.toFixed(3)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── LIMITES ─── */}
        <TabsContent value="limits">
          <Card>
            <CardHeader className="pb-3 space-y-2">
              <CardTitle className="text-sm">Limites diários por tier</CardTitle>
              <Button
                size="sm"
                className="w-full"
                onClick={() => void handleSaveAllLimits()}
                disabled={!hasDirtyLimits || saving === "limits-all"}
              >
                {saving === "limits-all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar alterações
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionTypes.map((actionType) => (
                <div key={actionType} className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium capitalize">{actionType.replace(/_/g, " ")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIER_ORDER.map((tier) => {
                      const Meta = TIER_META[tier];
                      const Icon = Meta.icon;
                      const limit = limits.find((item) => item.tier === tier && item.action_type === actionType);
                      if (!limit) return <div key={`${tier}-${actionType}`} />;
                      return (
                        <div key={limit.id} className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <Icon className="h-3 w-3" />
                            <span className="text-[10px] font-medium">{Meta.label}</span>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 text-center text-sm tabular-nums"
                            value={editLimits[limit.id] ?? limit.daily_limit}
                            onChange={(e) => setEditLimits((prev) => ({ ...prev, [limit.id]: Number(e.target.value) }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── USUÁRIOS ─── */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Tier de cada usuário</CardTitle>
              <CardDescription className="text-xs">{users.length} usuário(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {users.map((u) => {
                  const tier = tiers[u.id] ?? "free";
                  const Meta = TIER_META[tier];
                  const usageInfo = usage[u.id];
                  return (
                    <div key={u.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{u.display_name || "(sem nome)"}</div>
                          <div className="text-[10px] text-muted-foreground">{u.id.slice(0, 8)}…</div>
                        </div>
                        <Select value={tier} onValueChange={(v) => handleSetTier(u.id, v as AITier)} disabled={saving === u.id}>
                          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="pro_plus">Pro+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {usageInfo && (
                        <div className="text-xs text-muted-foreground">
                          {usageInfo.calls} chamadas · {(usageInfo.tokens / 1000).toFixed(1)}k tok · ${usageInfo.cost.toFixed(3)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
