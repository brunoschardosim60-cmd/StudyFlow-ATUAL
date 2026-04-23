import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_SUBJECTS, type Subject } from "@/lib/studyData";

const OBJECTIVES = [
  { value: "enem", label: "ENEM" },
  { value: "vestibular", label: "Vestibular" },
  { value: "concurso", label: "Concurso" },
  { value: "faculdade", label: "Faculdade" },
  { value: "aprender", label: "Aprender por conta" },
];

const ROUTINES = [
  { value: "estuda", label: "Só estudo" },
  { value: "trabalha_estuda", label: "Trabalho + estudo" },
  { value: "trabalha", label: "Só trabalho" },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [objetivo, setObjetivo] = useState("");
  const [tempoDisponivel, setTempoDisponivel] = useState(60);
  const [materiasDificeis, setMateriasDificeis] = useState<Subject[]>([]);
  const [rotina, setRotina] = useState("");
  const [metaResultado, setMetaResultado] = useState("");

  const toggleMateria = (m: Subject) => {
    setMateriasDificeis((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const canNext = () => {
    if (step === 0) return !!objetivo;
    if (step === 1) return tempoDisponivel > 0;
    if (step === 2) return materiasDificeis.length > 0;
    if (step === 3) return !!rotina;
    if (step === 4) return !!metaResultado;
    return true;
  };

  const handleFinish = async () => {
    if (!user) {
      toast.error("Você precisa estar logado.");
      return;
    }
    setLoading(true);
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

      // Ask Flora to generate initial plan
      try {
        await supabase.functions.invoke("flora-engine", {
          body: {
            action: "generate_initial_plan",
            userId: user.id,
          },
        });
      } catch {
        // Non-critical - plan can be generated later
      }

      toast.success("Onboarding concluído! A Flora já está preparando seu plano.");
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    // Step 0: Objetivo
    <div key="0" className="space-y-4">
      <h2 className="font-heading text-xl font-bold">Qual seu objetivo?</h2>
      <p className="text-sm text-muted-foreground">Isso ajuda a Flora a personalizar seu plano.</p>
      <div className="grid grid-cols-2 gap-3">
        {OBJECTIVES.map((obj) => (
          <button
            key={obj.value}
            onClick={() => setObjetivo(obj.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              objetivo === obj.value
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            <p className="font-medium">{obj.label}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 1: Tempo
    <div key="1" className="space-y-4">
      <h2 className="font-heading text-xl font-bold">Quanto tempo por dia?</h2>
      <p className="text-sm text-muted-foreground">A Flora vai adaptar a carga ao seu tempo.</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { value: 30, label: "30 min", desc: "Sessões rápidas e focadas" },
          { value: 60, label: "1 hora", desc: "Bom ritmo diário" },
          { value: 120, label: "2 horas", desc: "Estudo consistente" },
          { value: 180, label: "3 horas", desc: "Ritmo forte" },
          { value: 240, label: "4 horas", desc: "Dedicação intensa" },
          { value: 360, label: "6 horas+", desc: "Modo vestibular" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTempoDisponivel(opt.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              tempoDisponivel === opt.value
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Matérias difíceis
    <div key="2" className="space-y-4">
      <h2 className="font-heading text-xl font-bold">Matérias com dificuldade</h2>
      <p className="text-sm text-muted-foreground">Selecione as que você mais precisa de ajuda.</p>
      <div className="flex flex-wrap gap-2">
        {ALL_SUBJECTS.map((m) => (
          <Badge
            key={m}
            variant={materiasDificeis.includes(m) ? "default" : "outline"}
            className="cursor-pointer text-sm py-2 px-3"
            onClick={() => toggleMateria(m)}
          >
            {m}
          </Badge>
        ))}
      </div>
    </div>,

    // Step 3: Rotina
    <div key="3" className="space-y-4">
      <h2 className="font-heading text-xl font-bold">Qual sua rotina?</h2>
      <p className="text-sm text-muted-foreground">Isso ajuda a Flora a entender seu contexto.</p>
      <div className="grid gap-3">
        {ROUTINES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRotina(r.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              rotina === r.value
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            <p className="font-medium">{r.label}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 4: Meta
    <div key="4" className="space-y-4">
      <h2 className="font-heading text-xl font-bold">Qual sua meta?</h2>
      <p className="text-sm text-muted-foreground">Ex: "Passar em Medicina na USP", "Nota 900 no ENEM"</p>
      <Input
        placeholder="Descreva sua meta..."
        value={metaResultado}
        onChange={(e) => setMetaResultado(e.target.value)}
      />
    </div>,
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold">StudyFlow</h1>
          <p className="text-muted-foreground text-sm">
            A Flora precisa te conhecer melhor
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="glass-card rounded-2xl p-6">{steps[step]}</div>

        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
          )}
          <div className="flex-1" />
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="gap-1.5">
              Próximo <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={!canNext() || loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Começar
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
