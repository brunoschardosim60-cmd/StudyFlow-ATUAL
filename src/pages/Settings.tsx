import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CustomThemeDialog } from "@/components/CustomThemeDialog";
import { Sun, Moon, CircleDot, LogOut, ArrowLeft, Shield, User, Target, Sparkles, Bell, BellOff, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { getMyTier, getMyQuota, type AITier } from "@/lib/aiUsage";

const TIER_LABEL: Record<AITier, string> = { free: "Free", pro: "Pro", pro_plus: "Pro+" };

const OBJECTIVES = [
  { value: "enem", label: "ENEM" },
  { value: "vestibular", label: "Vestibular" },
  { value: "concurso", label: "Concurso" },
  { value: "faculdade", label: "Faculdade" },
  { value: "aprender", label: "Aprender por conta" },
];

export default function Settings() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Onboarding
  const [objetivo, setObjetivo] = useState("");
  const [metaResultado, setMetaResultado] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  // Quota
  const [tier, setTier] = useState<AITier>("free");
  const [quotas, setQuotas] = useState<{ action: string; used: number; limit: number }[]>([]);

  // Notifications
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  const themes = [
    { id: "light" as const, label: "Claro", icon: Sun },
    { id: "dark" as const, label: "Escuro", icon: Moon },
    { id: "black" as const, label: "Preto", icon: CircleDot },
  ];

  // Load profile + onboarding + quota
  useEffect(() => {
    if (!user) return;
    // Profile
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.display_name) setDisplayName(data.display_name); });
    // Onboarding
    supabase.from("student_onboarding").select("objetivo,meta_resultado").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.objetivo) setObjetivo(data.objetivo);
        if (data?.meta_resultado) setMetaResultado(data.meta_resultado);
      });
    // Quota
    (async () => {
      const t = await getMyTier();
      setTier(t);
      const actions = ["chat", "quiz", "essay_correction", "solve_math"];
      const results = await Promise.all(actions.map(a => getMyQuota(a)));
      setQuotas(results.filter(Boolean).map((q, i) => ({
        action: actions[i],
        used: q!.used,
        limit: q!.limit,
      })));
    })();
    // Notifications
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, [user]);

  async function handleSaveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
      if (error) throw error;
      toast.success("Nome atualizado.");
    } catch {
      toast.error("Erro ao salvar nome.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveGoal() {
    if (!user) return;
    setSavingGoal(true);
    try {
      const { error } = await supabase.from("student_onboarding").upsert({
        user_id: user.id,
        objetivo,
        meta_resultado: metaResultado,
        completed: true,
      } as any);
      if (error) throw error;
      toast.success("Objetivo atualizado. A Flora vai se adaptar.");
    } catch {
      toast.error("Erro ao salvar objetivo.");
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleRequestNotifications() {
    if (!("Notification" in window)) {
      toast.error("Seu navegador não suporta notificações.");
      return;
    }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      toast.success("Notificações ativadas! Você receberá lembretes de revisão.");
    } else {
      toast.info("Permissão negada. Você pode alterar nas configurações do navegador.");
    }
  }

  const ACTION_LABELS: Record<string, string> = {
    chat: "Chat Flora",
    quiz: "Quiz",
    essay_correction: "Correção de redação",
    solve_math: "Resolver matemática",
  };

  return (
    <div className="min-h-screen bg-background animate-page-slide-in pb-20 md:pb-6">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-heading font-bold text-lg">Configurações</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {/* Profile */}
        {user && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
            <h2 className="font-heading font-semibold text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Perfil
            </h2>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome de exibição</label>
              <div className="flex gap-2">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome..."
                  className="flex-1"
                />
                <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Conta: {user.email}</p>
          </section>
        )}

        {/* Objetivo */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <h2 className="font-heading font-semibold text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Objetivo de estudo
          </h2>
          <div className="flex flex-wrap gap-2">
            {OBJECTIVES.map((obj) => (
              <button
                key={obj.value}
                onClick={() => setObjetivo(obj.value)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                  objetivo === obj.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 text-muted-foreground"
                }`}
              >
                {obj.label}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Meta</label>
            <Input
              value={metaResultado}
              onChange={(e) => setMetaResultado(e.target.value)}
              placeholder="Ex: Nota 900 no ENEM, Passar em Medicina..."
            />
          </div>
          <Button onClick={handleSaveGoal} disabled={savingGoal || !objetivo} size="sm" className="gap-1.5">
            {savingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar objetivo
          </Button>
        </section>

        {/* Theme */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <h2 className="font-heading font-semibold text-base">Tema</h2>
          <div className="flex gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all text-sm font-medium ${
                  theme === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 text-muted-foreground"
                }`}
              >
                <t.icon className="w-5 h-5" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="pt-2">
            <CustomThemeDialog />
          </div>
        </section>

        {/* Quota */}
        {(() => {
          const totalUsed = quotas.reduce((s, q) => s + q.used, 0);
          const totalLimit = quotas.reduce((s, q) => s + q.limit, 0);
          const pct = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;
          const barColor = pct >= 90 ? "bg-destructive" : pct >= 60 ? "bg-yellow-500" : "bg-primary";
          return (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
              <h2 className="font-heading font-semibold text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Uso de IA hoje
                <Badge variant="secondary" className="text-xs">{TIER_LABEL[tier]}</Badge>
              </h2>
              {quotas.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{totalUsed} de {totalLimit} ações</span>
                    <span className={pct >= 90 ? "text-destructive font-semibold" : "text-foreground font-medium"}>{pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                    {quotas.map((q) => (
                      <span key={q.action}>
                        {ACTION_LABELS[q.action] || q.action}: {q.used}/{q.limit}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              )}
            </section>
          );
        })()}

        {/* Notifications */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <h2 className="font-heading font-semibold text-base flex items-center gap-2">
            {notifPermission === "granted" ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
            Notificações
          </h2>
          {notifPermission === "granted" ? (
            <p className="text-sm text-muted-foreground">
              ✅ Notificações ativadas. Você receberá lembretes de revisão e alarmes do timer.
            </p>
          ) : notifPermission === "denied" ? (
            <p className="text-sm text-muted-foreground">
              ❌ Notificações bloqueadas. Para ativar, acesse as configurações do navegador e permita notificações para este site.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Ative notificações para receber lembretes de revisão, alarmes do timer e dicas da Flora.
              </p>
              <Button onClick={handleRequestNotifications} variant="outline" size="sm" className="gap-1.5">
                <Bell className="w-4 h-4" /> Ativar notificações
              </Button>
            </div>
          )}
        </section>

        {/* Admin */}
        {isAdmin && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/admin")}>
              <Shield className="w-4 h-4" /> Painel Admin
            </Button>
          </section>
        )}

        {/* Logout */}
        {user && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <Button variant="destructive" className="w-full gap-2" onClick={signOut}>
              <LogOut className="w-4 h-4" /> Sair da conta
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
