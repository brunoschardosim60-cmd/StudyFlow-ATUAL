import { useEffect, useMemo, useState } from "react";
import { prefetchForContext } from "@/lib/prefetch";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, PlusCircle, Sparkles, Trash2, Wand2, Save, CheckCircle2, AlertCircle, Target, CalendarDays, CalendarRange, Dumbbell, Lightbulb, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPETENCIAS,
  correctEssay,
  countLines,
  countWords,
  createEssay,
  deleteEssay,
  listEssays,
  suggestEssayTheme,
  updateEssayDraft,
  type CompetenciaFeedback,
  type Essay,
} from "@/lib/essays";
import { reportError, toErrorMessage } from "@/lib/errorHandling";

// ─── Configuração por objetivo ────────────────────────────────────────────────

type Objetivo = "enem" | "vestibular" | "concurso" | "faculdade" | "aprender" | string;

function getObjetivoConfig(objetivo: Objetivo) {
  switch (objetivo) {
    case "enem":
    case "vestibular":
      return {
        label: "ENEM",
        minLines: 25,
        maxLines: 35,
        minWords: 150,
        placeholder: "Escreva sua redação dissertativa-argumentativa aqui. O ENEM exige entre 150 e 500 palavras.",
        dica: "O ENEM exige: tese clara, 2 argumentos desenvolvidos e proposta de intervenção completa.",
        isENEM: true,
      };
    case "concurso":
      return {
        label: "Concurso",
        minLines: 15,
        maxLines: 30,
        minWords: 100,
        placeholder: "Escreva sua redação dissertativa ou técnica aqui. Foque em clareza e objetividade.",
        dica: "Em concurso: seja objetivo, use linguagem formal e estruture bem introdução, desenvolvimento e conclusão.",
        isENEM: false,
      };
    case "faculdade":
    case "aprender":
    default:
      return {
        label: "Redação",
        minLines: 15,
        maxLines: 40,
        minWords: 100,
        placeholder: "Escreva sua redação aqui. Foque em clareza, coerência e argumentação.",
        dica: "Uma boa redação tem: tese clara, argumentos bem fundamentados e conclusão que retoma a tese.",
        isENEM: false,
      };
  }
}

// ─── Competências para UI ENEM ────────────────────────────────────────────────

const CRITERIOS_GERAL = [
  { key: "competencia_1", label: "Clareza e objetividade", desc: "A argumentação é direta e o leitor entende o ponto de vista?" },
  { key: "competencia_2", label: "Argumentação", desc: "Os argumentos são sólidos, coerentes e bem fundamentados?" },
  { key: "competencia_3", label: "Norma culta", desc: "Gramática, ortografia, concordância, regência, pontuação" },
  { key: "competencia_4", label: "Estrutura e coesão", desc: "A organização é eficiente? Os parágrafos se conectam?" },
] as const;

export default function Redacao() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tema, setTema] = useState("");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correctionStep, setCorrectionStep] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [objetivo, setObjetivo] = useState<Objetivo>("enem");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [feedbackRevealed, setFeedbackRevealed] = useState(false);
  const [lastSavedTexto, setLastSavedTexto] = useState("");
  const [lastSavedTema, setLastSavedTema] = useState("");
  function hashText(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36);
  }
  function fingerprintOf(t: string, x: string) {
    return `${hashText(t.trim())}:${hashText(x.trim())}`;
  }

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
    prefetchForContext("redacao");
  }, [authLoading, user, navigate]);

  // Busca o objetivo do onboarding para adaptar a UI
  useEffect(() => {
    if (!user) return;
    supabase
      .from("student_onboarding")
      .select("objetivo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.objetivo) setObjetivo(data.objetivo as Objetivo);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await listEssays();
      setEssays(list);
      if (list.length && !selectedId) selectEssay(list[0]);
    } catch (error) {
      reportError("listEssays", error, { devOnly: true });
      toast.error("Não foi possível carregar suas redações.");
    } finally {
      setLoading(false);
    }
  }

  function selectEssay(essay: Essay) {
    setSelectedId(essay.id);
    setTema(essay.tema);
    setTexto(essay.texto);
    setLastSavedTema(essay.tema);
    setLastSavedTexto(essay.texto);
    setFeedbackRevealed(false);
    requestAnimationFrame(() => setFeedbackRevealed(true));
  }

  const selected = useMemo(() => essays.find((e) => e.id === selectedId) ?? null, [essays, selectedId]);

  // Autosave: debounce 30s
  useEffect(() => {
    if (!selected || selected.status === "corrigida") return;
    if (tema === lastSavedTema && texto === lastSavedTexto) return;
    if (!texto.trim()) return;
    const timer = setTimeout(async () => {
      try {
        await updateEssayDraft(selected.id, { tema, texto });
        setLastSavedTema(tema);
        setLastSavedTexto(texto);
      } catch { /* silent autosave */ }
    }, 30000);
    return () => clearTimeout(timer);
  }, [tema, texto, selected, lastSavedTema, lastSavedTexto]);
  const config = getObjetivoConfig(objetivo);
  const wordCount = countWords(texto);
  const lineCount = countLines(texto);
  const lineProgress = Math.min(100, (lineCount / config.maxLines) * 100);

  // Cor da barra de progresso baseada no estado
  const progressColor =
    lineCount < config.minLines ? "bg-orange-400" :
    lineCount <= config.maxLines ? "bg-green-500" : "bg-red-400";

  async function handleNew() {
    if (!user) return;
    try {
      const essay = await createEssay(user.id, "");
      setEssays((prev) => [essay, ...prev]);
      selectEssay(essay);
      toast.success("Nova redação criada.");
    } catch (error) {
      reportError("createEssay", error, { devOnly: true });
      toast.error(toErrorMessage(error, "Não foi possível criar a redação."));
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await updateEssayDraft(selected.id, { tema, texto });
      await refresh();
      toast.success("Rascunho salvo.");
    } catch (error) {
      reportError("updateEssayDraft", error, { devOnly: true });
      toast.error(toErrorMessage(error, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggestTheme() {
    setSuggesting(true);
    try {
      const next = await suggestEssayTheme();
      setTema(next);
      toast.success("Tema sugerido pela Flora.");
    } catch (error) {
      reportError("suggestEssayTheme", error, { devOnly: true });
      toast.error(toErrorMessage(error, "Não foi possível sugerir um tema."));
    } finally {
      setSuggesting(false);
    }
  }

  async function handleCorrect() {
    if (!selected) return;
    if (correcting) return; // 🛡️ guard duplo clique / StrictMode
    if (lineCount < config.minLines) {
      toast.error(`Escreva pelo menos ${config.minLines} linhas para uma redação completa.`);
      return;
    }
    // 🧠 Cache persistente: se o texto+tema bate com o que já foi corrigido no banco, reaproveita
    const currentFp = fingerprintOf(tema, texto);
    const savedFp =
      selected.status === "corrigida" && selected.corrected_at
        ? fingerprintOf(selected.tema, selected.texto)
        : null;
    if (savedFp && savedFp === currentFp) {
      toast.info("Usando resposta anterior — sem mudanças no texto.", {
        description: "Edite o tema ou texto para gerar uma nova correção.",
      });
      return;
    }
    setCorrecting(true);
    setCorrectionStep("Salvando rascunho...");
    try {
      await updateEssayDraft(selected.id, { tema, texto });
      setCorrectionStep("Analisando estrutura e argumentos...");
      // Small delay so user sees the step change
      await new Promise(r => setTimeout(r, 400));
      setCorrectionStep("Flora corrigindo competências...");
      await correctEssay(selected.id, tema, texto);
      setCorrectionStep("Finalizando correção...");
      await refresh();
      setFeedbackRevealed(false);
      // Trigger staggered reveal after a tick
      requestAnimationFrame(() => setFeedbackRevealed(true));
      toast.success("Correção concluída pela Flora.");
    } catch (error) {
      reportError("correctEssay", error, { devOnly: true });
      toast.error(toErrorMessage(error, "Não foi possível corrigir a redação."));
    } finally {
      setCorrecting(false);
      setCorrectionStep(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Apagar essa redação?")) return;
    try {
      await deleteEssay(id);
      if (selectedId === id) { setSelectedId(null); setTema(""); setTexto(""); }
      await refresh();
      toast.success("Redação removida.");
    } catch (error) {
      reportError("deleteEssay", error, { devOnly: true });
      toast.error(toErrorMessage(error, "Não foi possível apagar."));
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const feedbackComp = (selected?.feedback_competencias as CompetenciaFeedback | null) ?? null;
  const isCorrected = selected?.status === "corrigida" && selected.nota_total !== null;
  const isENEM = config.isENEM;

  // Para concurso/faculdade: nota_total está em escala 0-1000 (nota*100)
  // Converte de volta para 0-10
  const notaGeralDe10 = !isENEM && selected?.nota_total != null
    ? (selected.nota_total / 100).toFixed(1)
    : null;

  const metaObj = feedbackComp?._meta as any;
  const paragrafos = feedbackComp?._paragrafos;

  return (
    <div className="min-h-screen bg-background animate-page-slide-in">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-2xl font-bold">
                Redação
                <Badge variant="secondary" className="ml-2 text-xs align-middle">{config.label}</Badge>
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isENEM
                ? "Escreva e receba correção pelas 5 competências do ENEM."
                : `Escreva e receba correção no padrão ${config.label}.`}
            </p>
          </div>
          <Button onClick={() => void handleNew()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova redação
          </Button>
        </div>

        <div className={`grid gap-4 ${sidebarOpen ? "lg:grid-cols-[300px_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
          {/* Sidebar */}
          <section className={`space-y-2 rounded-2xl border border-border bg-card/70 p-3 ${sidebarOpen ? "" : "hidden"}`}>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium">Suas redações</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{essays.length}</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                  title="Recolher painel"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : essays.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nenhuma redação ainda. Clique em "Nova redação".
              </p>
            ) : (
              <div className="space-y-2">
                {essays.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => selectEssay(e)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedId === e.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium">{e.tema || "Sem tema"}</p>
                      {e.status === "corrigida" && e.nota_total !== null ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {isENEM ? e.nota_total : (e.nota_total / 100).toFixed(1)}
                          {!isENEM && "/10"}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          Rascunho
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")} · {e.line_count} linhas
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Botão para reabrir sidebar quando recolhida */}
          {!sidebarOpen && (
            <div className="flex items-start lg:col-span-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="mb-2 flex items-center gap-1.5 rounded-lg border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
                title="Expandir redações"
              >
                <PanelLeftOpen className="h-4 w-4" />
                <span>Suas redações ({essays.length})</span>
              </button>
            </div>
          )}

          {/* Editor + Feedback */}
          <section className="space-y-4">
            {!selected ? (
              <div className="rounded-2xl border border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
                Selecione uma redação ou crie uma nova.
              </div>
            ) : (
              <>
                {/* Editor */}
                <div className="space-y-3 rounded-2xl border border-border bg-card/70 p-4">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[260px] flex-1 space-y-1">
                      <label className="text-sm font-medium">Tema da redação</label>
                      <Input
                        value={tema}
                        onChange={(e) => setTema(e.target.value)}
                        placeholder={isENEM
                          ? "Ex: Os desafios da educação digital no Brasil"
                          : "Ex: A importância da transparência na gestão pública"}
                      />
                    </div>
                    <Button variant="outline" onClick={() => void handleSuggestTheme()} disabled={suggesting}>
                      {suggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Sugerir tema
                    </Button>
                  </div>

                  {/* Dica contextual */}
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{config.dica}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Texto da redação</label>
                      <span className="text-xs text-muted-foreground">
                        {wordCount} palavras · ~{lineCount} linhas
                        <span className={lineCount >= config.minLines && lineCount <= config.maxLines
                          ? " text-green-600" : " text-orange-500"}>
                          {" "}(alvo {config.minLines}–{config.maxLines})
                        </span>
                      </span>
                    </div>
                    <Textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder={config.placeholder}
                      className="min-h-[420px] font-serif text-base leading-relaxed"
                    />
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                        style={{ width: `${lineProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleDelete(selected.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Apagar
                    </Button>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => void handleSave()} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar rascunho
                      </Button>
                      <Button onClick={() => void handleCorrect()} disabled={correcting || !texto.trim()}>
                        {correcting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        {correcting ? (correctionStep || "Corrigindo...") : "Corrigir com a Flora"}
                      </Button>
                    </div>
                  </div>

                  {/* Progressive correction overlay */}
                  {correcting && (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <Wand2 className="h-4 w-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div>
                          <p className="font-heading font-semibold text-sm">Flora está corrigindo</p>
                          <p className="text-sm text-muted-foreground animate-pulse">{correctionStep}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {["Salvando rascunho...", "Analisando estrutura e argumentos...", "Flora corrigindo competências...", "Finalizando correção..."].map((step, i) => {
                          const steps = ["Salvando rascunho...", "Analisando estrutura e argumentos...", "Flora corrigindo competências...", "Finalizando correção..."];
                          const currentIdx = steps.indexOf(correctionStep || "");
                          const isDone = i < currentIdx;
                          const isCurrent = i === currentIdx;
                          return (
                            <div key={step} className={`flex items-center gap-2 text-sm transition-all duration-300 ${isDone ? "text-primary" : isCurrent ? "text-foreground" : "text-muted-foreground/50"}`}>
                              {isDone ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : isCurrent ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                              ) : (
                                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                              )}
                              {step.replace("...", "")}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Feedback ── */}
                {isCorrected && (
                  <div className={`space-y-4 rounded-2xl border border-border bg-card/70 p-4 transition-all duration-500 ${feedbackRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <h2 className="font-heading text-lg font-semibold">Correção da Flora</h2>
                        <Badge variant="outline" className="text-xs">{config.label}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Nota</p>
                        {isENEM ? (
                          <p className="font-heading text-3xl font-bold text-primary">
                            {selected.nota_total}
                            <span className="text-base text-muted-foreground"> / 1000</span>
                          </p>
                        ) : (
                          <p className="font-heading text-3xl font-bold text-primary">
                            {notaGeralDe10}
                            <span className="text-base text-muted-foreground"> / 10</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Alertas ENEM (fuga de tema, tipo textual) */}
                    {isENEM && (() => {
                      const meta = metaObj;
                      if (!meta) return null;
                      const isFuga = meta.fuga_tipo_textual || meta.aderencia_tema === "fuga_total";
                      const isTangencia = meta.aderencia_tema === "tangencia";
                      if (!isFuga && !isTangencia) return null;
                      const tone = isFuga
                        ? "border-destructive/40 bg-destructive/5 text-destructive"
                        : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400";
                      return (
                        <div className={`rounded-xl border p-3 ${tone}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {isFuga ? "Alerta crítico" : "Atenção"}
                          </p>
                          <ul className="mt-1 space-y-1 text-sm">
                            {meta.fuga_tipo_textual && (
                              <li>Tipo textual identificado: <strong>{meta.tipo_textual}</strong>. O ENEM exige dissertativo-argumentativo — competências 2 a 5 zeradas.</li>
                            )}
                            {meta.aderencia_tema === "fuga_total" && (
                              <li>Fuga total ao tema. {meta.aderencia_justificativa}</li>
                            )}
                            {meta.aderencia_tema === "tangencia" && (
                              <li>Tangenciamento do tema. {meta.aderencia_justificativa}</li>
                            )}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Nível (concurso/faculdade) */}
                    {!isENEM && metaObj?.nivel && (
                      <div className="flex items-center gap-2">
                        <Badge>{metaObj.nivel}</Badge>
                      </div>
                    )}

                    {/* Feedback geral */}
                    {selected.feedback_geral && (
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <p className="text-xs font-medium text-muted-foreground">Análise geral</p>
                        <p className="mt-1 text-sm">{selected.feedback_geral}</p>
                      </div>
                    )}

                    {/* Competências ENEM */}
                    {isENEM && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {COMPETENCIAS.map((comp) => {
                          const score = (selected[comp.key as keyof Essay] as number | null) ?? 0;
                          const fbRaw = feedbackComp?.[comp.key as keyof CompetenciaFeedback];
                          const fb = typeof fbRaw === "string" ? fbRaw : "";
                          const pct = (score / 200) * 100;
                          const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : pct >= 40 ? "bg-orange-500" : "bg-red-400";
                          return (
                            <div key={comp.key} className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Competência {comp.num}
                                  </p>
                                  <p className="text-sm font-medium">{comp.title}</p>
                                </div>
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
                                  {score}<span className="text-xs text-muted-foreground">/200</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs text-muted-foreground">{comp.description}</p>
                              {fb && <p className="text-sm whitespace-pre-line">{fb}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Critérios para concurso/faculdade */}
                    {!isENEM && feedbackComp && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {CRITERIOS_GERAL.map((crit) => {
                          const fbRaw = feedbackComp[crit.key as keyof CompetenciaFeedback];
                          const fb = typeof fbRaw === "string" ? fbRaw : "";
                          if (!fb) return null;
                          return (
                            <div key={crit.key} className="space-y-1 rounded-xl border border-border bg-background/60 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{crit.label}</p>
                              <p className="text-xs text-muted-foreground">{crit.desc}</p>
                              <p className="text-sm">{fb}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Próximos passos (concurso/faculdade) */}
                    {!isENEM && metaObj?.proximos_passos?.length > 0 && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Próximos passos</p>
                        <ul className="space-y-1">
                          {(metaObj.proximos_passos as string[]).map((passo, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                              {passo}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Análise por parágrafo */}
                    {paragrafos && (
                      <div className="space-y-3">
                        <h3 className="font-heading text-base font-semibold">Análise por parágrafo</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          {([
                            ["introducao", "Introdução"],
                            ["desenvolvimento_1", "Desenvolvimento 1"],
                            ["desenvolvimento_2", "Desenvolvimento 2"],
                            ["conclusao", "Conclusão / Proposta"],
                          ] as const).map(([key, label]) => {
                            const p = paragrafos?.[key];
                            if (!p) return null;
                            return (
                              <div key={key} className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                                <p className="text-sm">{p.diagnostico}</p>
                                {p.sugestao_reescrita && (
                                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Sugestão de reescrita</p>
                                    <p className="mt-1 text-sm italic">{p.sugestao_reescrita}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Plano de estudo personalizado ── */}
                    {(() => {
                      const plano = metaObj?.plano_estudo as
                        | { diagnostico?: string[]; curto_prazo?: string[]; medio_prazo?: string[]; treino_direcionado?: string; dica_estrategica?: string }
                        | undefined;
                      if (!plano) return null;
                      const hasAny =
                        (plano.diagnostico?.length ?? 0) > 0 ||
                        (plano.curto_prazo?.length ?? 0) > 0 ||
                        (plano.medio_prazo?.length ?? 0) > 0 ||
                        plano.treino_direcionado ||
                        plano.dica_estrategica;
                      if (!hasAny) return null;
                      return (
                        <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            <h3 className="font-heading text-base font-semibold">Plano de estudo personalizado</h3>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Flora</Badge>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {plano.diagnostico && plano.diagnostico.length > 0 && (
                              <div className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 text-primary" />
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnóstico</p>
                                </div>
                                <ul className="space-y-1 text-sm">
                                  {plano.diagnostico.map((d, i) => (
                                    <li key={i} className="flex gap-2">
                                      <span className="text-primary">•</span>
                                      <span>{d}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {plano.curto_prazo && plano.curto_prazo.length > 0 && (
                              <div className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4 text-primary" />
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Curto prazo · 3–7 dias</p>
                                </div>
                                <ul className="space-y-1 text-sm">
                                  {plano.curto_prazo.map((d, i) => (
                                    <li key={i} className="flex gap-2">
                                      <span className="text-primary">•</span>
                                      <span>{d}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {plano.medio_prazo && plano.medio_prazo.length > 0 && (
                              <div className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
                                <div className="flex items-center gap-2">
                                  <CalendarRange className="h-4 w-4 text-primary" />
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Médio prazo · 2 semanas</p>
                                </div>
                                <ul className="space-y-1 text-sm">
                                  {plano.medio_prazo.map((d, i) => (
                                    <li key={i} className="flex gap-2">
                                      <span className="text-primary">•</span>
                                      <span>{d}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {plano.treino_direcionado && (
                              <div className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
                                <div className="flex items-center gap-2">
                                  <Dumbbell className="h-4 w-4 text-primary" />
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Treino direcionado</p>
                                </div>
                                <p className="text-sm">{plano.treino_direcionado}</p>
                              </div>
                            )}
                          </div>

                          {plano.dica_estrategica && (
                            <div className="flex gap-3 rounded-xl border border-primary/30 bg-background/60 p-3">
                              <Lightbulb className="h-5 w-5 shrink-0 text-primary" />
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dica estratégica</p>
                                <p className="mt-1 text-sm italic">{plano.dica_estrategica}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
