import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloraIcon } from "@/components/FloraIcon";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Target,
  Clock,
  BookOpen,
  Briefcase,
  GraduationCap,
  Trophy,
  Check,
  Crosshair,
  Building2,
  FileText,
  Lightbulb,
  Zap,
  Sun,
  Flame,
  Dumbbell,
  Rocket,
  Award,
  Scale,
  BookMarked,
  Moon,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { ALL_SUBJECTS, type Subject } from "@/lib/studyData";
import { useTheme } from "next-themes";

/* ─── Data ─── */
const OBJECTIVES = [
  { value: "enem", label: "ENEM", icon: Crosshair, desc: "Vestibular nacional unificado" },
  { value: "vestibular", label: "Vestibular", icon: Building2, desc: "Universidade específica" },
  { value: "concurso", label: "Concurso", icon: FileText, desc: "Concurso público" },
  { value: "faculdade", label: "Faculdade", icon: GraduationCap, desc: "Graduação em andamento" },
  { value: "aprender", label: "Aprender", icon: Lightbulb, desc: "Estudo por curiosidade" },
];

const TIME_OPTIONS = [
  { value: 30, label: "30 min", icon: Zap, desc: "Sessões rápidas" },
  { value: 60, label: "1 hora", icon: Sun, desc: "Ritmo equilibrado" },
  { value: 120, label: "2 horas", icon: Flame, desc: "Estudo consistente" },
  { value: 180, label: "3 horas", icon: Dumbbell, desc: "Preparação forte" },
  { value: 240, label: "4 horas", icon: Rocket, desc: "Dedicação intensa" },
  { value: 360, label: "6h+", icon: Award, desc: "Imersão total" },
];

const ROUTINES = [
  { value: "flexivel", label: "Rotina flexível", icon: BookMarked, desc: "Horários variam bastante" },
  { value: "equilibrada", label: "Equilibrada", icon: Scale, desc: "Tenho alguns horários fixos" },
  { value: "fixa", label: "Rotina fixa", icon: Calendar, desc: "Horários muito bem definidos" },
];

const STEP_ICONS = [Crosshair, Clock, BookOpen, Calendar, Trophy, Rocket];
const STEP_LABELS = ["Objetivo", "Tempo", "Matérias", "Rotina", "Meta", "Resumo"];
const TOTAL_STEPS = 6;

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [showWelcome, setShowWelcome] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  const [objetivo, setObjetivo] = useState("");
  const [tempoDisponivel, setTempoDisponivel] = useState(0);
  const [materiasDificeis, setMateriasDificeis] = useState<Subject[]>([]);
  const [rotina, setRotina] = useState("");
  const [metaResultado, setMetaResultado] = useState("");

  useEffect(() => {
    setContentVisible(false);
    const t = setTimeout(() => setContentVisible(true), 200);
    return () => clearTimeout(t);
  }, [step]);

  const toggleMateria = (m: Subject) => {
    setMateriasDificeis((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const canNext = useCallback(() => {
    if (step === 0) return !!objetivo;
    if (step === 1) return tempoDisponivel > 0;
    if (step === 2) return materiasDificeis.length > 0;
    if (step === 3) return !!rotina;
    if (step === 4) return !!metaResultado;
    return true;
  }, [step, objetivo, tempoDisponivel, materiasDificeis, rotina, metaResultado]);

  const goNext = () => {
    if (!canNext()) return;
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => s - 1);

  const handleFinish = async () => {
    if (!user) {
      toast.error("Você precisa estar logado.");
      return;
    }
    setLoading(true);
    setFinishing(true);

    try {
      const { error } = await supabase.from("student_onboarding").upsert({
        user_id: user.id,
        objetivo,
        tempo_disponivel_min: tempoDisponivel,
        materias_dificeis: materiasDificeis,
        rotina,
        meta_resultado: metaResultado,
        completed: true,
      } as any);

      if (error) throw error;

      try {
        await supabase.functions.invoke("flora-engine", {
          body: { action: "generate_initial_plan", userId: user.id },
        });
      } catch {
        // Non-critical
      }

      setTimeout(() => navigate("/"), 3500);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar dados. Tente novamente.");
      setFinishing(false);
      setLoading(false);
    }
  };

  const isDark = theme === "dark" || theme === "black";

  /* ─── Theme toggle (discrete) ─── */
  const ThemeToggle = () => (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="absolute top-4 right-4 z-20 p-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      title={isDark ? "Modo claro" : "Modo escuro premium"}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );

  /* ─── Finishing screen ─── */
  if (finishing) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[hsl(var(--background))]">
        <ThemeToggle />
        <div className="flex flex-col items-center gap-8">
          <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--primary))] flex items-center justify-center onboarding-float shadow-lg">
            <FloraIcon className="w-10 h-10 text-[hsl(var(--primary-foreground))]" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] font-['Space_Grotesk']">
              Montando seu plano
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs">
              A Flora está analisando seu perfil e criando um cronograma personalizado
            </p>
          </div>
          <div className="w-56 space-y-2">
            <div className="h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
              <div className="h-full bg-[hsl(var(--primary))] rounded-full onboarding-progress-bar" />
            </div>
            <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] font-medium tracking-wider uppercase">
              <span>Analisando</span>
              <span>Gerando plano</span>
            </div>
          </div>
        </div>
      </div>
    );
  }


  /* ─── Step content ─── */
  const StepIcon = STEP_ICONS[step];
  const objetivoLabel = OBJECTIVES.find((o) => o.value === objetivo)?.label;
  const tempoLabel = TIME_OPTIONS.find((t) => t.value === tempoDisponivel)?.label;
  const rotinaLabel = ROUTINES.find((r) => r.value === rotina)?.label;

  return (
    <div className="fixed inset-0 flex flex-col bg-[hsl(var(--background))] overflow-hidden">
      <ThemeToggle />

      {/* Progress bar */}
      <div className="shrink-0 px-6 pt-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-1.5 mb-2">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className="flex-1 flex items-center">
                <div
                  className={`h-1 w-full rounded-full transition-all duration-500 ${
                    i < step
                      ? "bg-[hsl(var(--primary))]"
                      : i === step
                      ? "bg-[hsl(var(--primary)/0.5)]"
                      : "bg-[hsl(var(--muted))]"
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
              {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Step header */}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
              <StepIcon className="w-6 h-6 text-[hsl(var(--primary))]" />
            </div>
            <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] font-['Space_Grotesk'] leading-tight">
              {step === 0 && "Vamos montar seu plano de estudos."}
              {step === 1 && "Quanto tempo por dia você consegue dedicar?"}
              {step === 2 && "Quais matérias precisam de mais atenção no momento?"}
              {step === 3 && "Como é sua rotina atual?"}
              {step === 4 && "Defina sua meta de resultado."}
              {step === 5 && "Tudo pronto para você alcançar seus objetivos!"}
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {step === 0 && "Qual é o seu objetivo principal?"}
              {step === 1 && "Seja realista. Você pode ajustar depois."}
              {step === 2 && "Selecione quantas quiser."}
              {step === 3 && "Isso nos ajuda a montar um plano que funcione pra você."}
              {step === 4 && "Quanto mais específica, melhor o plano da Flora."}
              {step === 5 && "Com base nas suas respostas, vamos criar um plano personalizado e inteligente."}
            </p>
          </div>

          {/* Step content */}
          <div
            className={`transition-all duration-400 ease-out ${
              contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {/* Step 0 — Objective */}
            {step === 0 && (
              <div className="space-y-2.5">
                {OBJECTIVES.map((obj) => {
                  const Icon = obj.icon;
                  const selected = objetivo === obj.value;
                  return (
                    <button
                      key={obj.value}
                      onClick={() => setObjetivo(obj.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-left ${
                        selected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] shadow-sm"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.3)]"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        selected
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${selected ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--foreground))]"}`}>
                          {obj.label}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{obj.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        selected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                          : "border-[hsl(var(--border))]"
                      }`}>
                        {selected && <Check className="w-3 h-3 text-[hsl(var(--primary-foreground))]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 1 — Time */}
            {step === 1 && (
              <div className="grid grid-cols-3 gap-3">
                {TIME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = tempoDisponivel === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTempoDisponivel(opt.value)}
                      className={`relative flex flex-col items-center p-4 rounded-2xl border transition-all duration-200 ${
                        selected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] shadow-sm"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.3)]"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-[hsl(var(--primary-foreground))]" />
                        </div>
                      )}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                        selected
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className={`text-sm font-bold ${selected ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--foreground))]"}`}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2 — Subjects */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2.5">
                  {ALL_SUBJECTS.map((m) => {
                    const selected = materiasDificeis.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMateria(m)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 border ${
                          selected
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--foreground))] font-semibold"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.3)]"
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />}
                        {m}
                      </button>
                    );
                  })}
                </div>
                {materiasDificeis.length > 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {materiasDificeis.length} matéria{materiasDificeis.length > 1 ? "s" : ""} selecionada{materiasDificeis.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* Step 3 — Routine */}
            {step === 3 && (
              <div className="grid grid-cols-3 gap-3">
                {ROUTINES.map((r) => {
                  const Icon = r.icon;
                  const selected = rotina === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setRotina(r.value)}
                      className={`relative flex flex-col items-center p-5 rounded-2xl border transition-all duration-200 text-center ${
                        selected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] shadow-sm"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.3)]"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-[hsl(var(--primary-foreground))]" />
                        </div>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                        selected
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className={`text-sm font-semibold ${selected ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--foreground))]"}`}>
                        {r.label}
                      </p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 leading-tight">{r.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 4 — Goal */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <Input
                    placeholder='Ex: "Medicina na USP", "Nota 900 no ENEM"'
                    value={metaResultado}
                    onChange={(e) => setMetaResultado(e.target.value)}
                    className="h-14 pl-[72px] text-sm rounded-2xl"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                  Quanto mais específica a meta, melhor o plano da Flora
                </p>
              </div>
            )}

            {/* Step 5 — Summary */}
            {step === 5 && (
              <div className="space-y-5">
                {/* Summary card */}
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-3">
                  {[
                    { icon: Target, label: "Objetivo", value: objetivoLabel },
                    { icon: Clock, label: "Tempo por dia", value: tempoLabel },
                    { icon: BookOpen, label: "Matérias selecionadas", value: `${materiasDificeis.length} matérias` },
                    { icon: Scale, label: "Rotina", value: rotinaLabel },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0"
                    >
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </div>
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.value}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                  Você pode ajustar tudo depois.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="shrink-0 px-6 pb-6 pt-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {step > 0 ? (
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors h-11 px-4 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          ) : <div />}
          <div className="flex-1" />
          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={goNext}
              disabled={!canNext()}
              className="h-12 px-8 rounded-2xl text-sm font-semibold gap-2 shadow-md"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={loading}
              className="h-12 px-8 rounded-2xl text-sm font-semibold gap-2 shadow-md"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Gerar meu plano
            </Button>
          )}
        </div>
      </div>

      {/* Security badge on last step */}
      {step === 5 && (
        <div className="shrink-0 pb-4 flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Seus dados estão protegidos com segurança.</span>
        </div>
      )}
    </div>
  );
}
