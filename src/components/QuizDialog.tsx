import { useState } from "react";
import { StudyTopic } from "@/lib/studyData";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle2, XCircle, Loader2, Trophy, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { floraGenerateQuiz } from "@/lib/floraClient";
import { calculateQuizXp, QUIZ_BASE_XP, QUIZ_DIFFICULTY_MULTIPLIER } from "@/lib/gamification";
import { MathText } from "./MathText";

interface QuizQuestion {
  pergunta: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
  feedbackErro?: string;
}

interface QuizDialogProps {
  topic: StudyTopic | null;
  open: boolean;
  onClose: () => void;
  onSaveResult: (payload: { topicId: string; score: number; total: number; wrongQuestions: string[]; difficulty?: "facil" | "medio" | "dificil" }) => void;
  /** Pre-loaded questions from Flora chat action */
  initialQuestions?: QuizQuestion[];
}

export function QuizDialog({ topic, open, onClose, onSaveResult, initialQuestions }: QuizDialogProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions || []);
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [difficulty, setDifficulty] = useState<"facil" | "medio" | "dificil">("medio");
  const [savedResult, setSavedResult] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20>(10);
  const [mode, setMode] = useState<"normal" | "review_errors">("normal");

  // Sync initialQuestions when they change
  const [lastInitial, setLastInitial] = useState(initialQuestions);
  if (initialQuestions !== lastInitial) {
    setLastInitial(initialQuestions);
    if (initialQuestions?.length) {
      setQuestions(initialQuestions);
      setCurrentQ(0);
      setSelectedAnswer(null);
      setScore(0);
      setFinished(false);
      setError("");
      setSavedResult(false);
      setWrongQuestions([]);
    }
  }

  const hasPreviousErrors = (topic?.quizErrors?.length ?? 0) > 0;

  const generateQuiz = async (overrideMode?: "normal" | "review_errors") => {
    if (!topic) return;
    const useMode = overrideMode ?? mode;

    setLoading(true);
    setError("");
    setQuestions([]);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setScore(0);
    setFinished(false);

    try {
      // Fetch notebook page content linked to this topic if available
      let pageContent: string | undefined;
      if (user?.id) {
        try {
          const { data: nbData } = await (await import("@/integrations/supabase/client")).supabase
            .from("notebooks")
            .select("id")
            .eq("user_id", user.id)
            .eq("topic_id", topic.id)
            .limit(1)
            .maybeSingle();
          if (nbData?.id) {
            const { data: pages } = await (await import("@/integrations/supabase/client")).supabase
              .from("notebook_pages")
              .select("content")
              .eq("notebook_id", nbData.id)
              .eq("user_id", user.id)
              .order("page_number")
              .limit(5);
            if (pages?.length) {
              pageContent = pages.map(p => p.content).filter(Boolean).join("\n\n").slice(0, 3000);
            }
          }
        } catch { /* non-critical */ }
      }

      const data = await floraGenerateQuiz(
        topic.materia,
        topic.tema,
        difficulty,
        {
          questionCount,
          mode: useMode,
          previousErrors: useMode === "review_errors" ? topic.quizErrors : undefined,
          pageContent,
        }
      );

      if (!data?.questions || !Array.isArray(data.questions)) {
        throw new Error("Formato de resposta invalido");
      }

      setQuestions(data.questions);
      setMode(useMode);
    } catch (err: unknown) {
      console.error("Quiz error:", err);
      setError("Erro ao gerar quiz. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    if (idx === questions[currentQ].correta) {
      setScore((s) => s + 1);
    } else {
      setWrongQuestions((prev) => [...prev, questions[currentQ].pergunta]);
    }
  };

  const nextQuestion = () => {
    if (currentQ + 1 >= questions.length) {
      setFinished(true);
      // Auto-save result when quiz finishes
      if (!savedResult && topic && questions.length > 0) {
        setTimeout(() => {
          saveQuizResult();
        }, 100);
      }
    } else {
      setCurrentQ((c) => c + 1);
      setSelectedAnswer(null);
    }
  };

  const resetQuiz = () => {
    setQuestions([]);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setScore(0);
    setFinished(false);
    setError("");
    setSavedResult(false);
    setWrongQuestions([]);
  };

  const getFloraFeedback = (pct: number): { message: string; nextDifficulty: "facil" | "medio" | "dificil" } => {
    if (pct >= 0.9) return { message: "Impressionante! Você dominou esse tema. Vou aumentar a dificuldade pra te desafiar mais.", nextDifficulty: "dificil" };
    if (pct >= 0.7) return { message: "Muito bem! Você tá no caminho certo. Vou manter a dificuldade pra consolidar.", nextDifficulty: difficulty === "facil" ? "medio" : difficulty };
    if (pct >= 0.5) return { message: "Quase lá. Revisa os pontos que errou e tenta de novo no mesmo nível.", nextDifficulty: difficulty };
    if (pct >= 0.3) return { message: "Sem stress. Vou simplificar as perguntas pra você fortalecer a base primeiro.", nextDifficulty: difficulty === "dificil" ? "medio" : "facil" };
    return { message: "Vamos com calma. Vou trazer questões mais simples pra você construir confiança.", nextDifficulty: "facil" };
  };

  const saveQuizResult = () => {
    if (!topic || savedResult || questions.length === 0) return;
    onSaveResult({
      topicId: topic.id,
      score,
      total: questions.length,
      wrongQuestions: Array.from(new Set(wrongQuestions)).slice(0, 3),
      difficulty,
    });
    setSavedResult(true);

    // Auto-adjust difficulty based on performance
    const pct = questions.length > 0 ? score / questions.length : 0;
    const { nextDifficulty } = getFloraFeedback(pct);
    setDifficulty(nextDifficulty);

    // Log each answer to student_performance via flora-engine
    if (user?.id) {
      import("@/lib/floraClient").then(({ logUserAction }) => {
        for (const q of questions) {
          const isCorrect = !wrongQuestions.includes(q.pergunta);
          logUserAction(
            isCorrect ? "quiz_correct" : "quiz_wrong",
            topic.id,
            topic.materia,
            { pergunta: q.pergunta.slice(0, 200) }
          );
        }
      });
    }
  };

  if (!topic) return null;

  const q = questions[currentQ];

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); resetQuiz(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent" />
            Quiz: {topic.tema}
          </DialogTitle>
          <DialogDescription>
            Responda as perguntas para revisar este tema e salvar seu desempenho.
          </DialogDescription>
        </DialogHeader>

        {questions.length === 0 && !loading && !error && (
          <div className="text-center py-6 space-y-4">
            <Brain className="w-12 h-12 text-accent mx-auto" />
            <p className="text-sm text-muted-foreground">
              Quiz sobre <strong>{topic.tema}</strong> ({topic.materia}).
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quantidade de questões</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {([5, 10, 15, 20] as const).map((n) => (
                  <Button
                    key={n}
                    variant={questionCount === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuestionCount(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Dificuldade</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button variant={difficulty === "facil" ? "default" : "outline"} size="sm" onClick={() => setDifficulty("facil")}>
                  Fácil <span className="ml-1 opacity-70 text-xs">×{QUIZ_DIFFICULTY_MULTIPLIER.facil}</span>
                </Button>
                <Button variant={difficulty === "medio" ? "default" : "outline"} size="sm" onClick={() => setDifficulty("medio")}>
                  Médio <span className="ml-1 opacity-70 text-xs">×{QUIZ_DIFFICULTY_MULTIPLIER.medio}</span>
                </Button>
                <Button variant={difficulty === "dificil" ? "default" : "outline"} size="sm" onClick={() => setDifficulty("dificil")}>
                  Difícil <span className="ml-1 opacity-70 text-xs">×{QUIZ_DIFFICULTY_MULTIPLIER.dificil}</span>
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Acertando 100% você ganha <strong>+{Math.round(QUIZ_BASE_XP * QUIZ_DIFFICULTY_MULTIPLIER[difficulty])} XP</strong>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button onClick={() => generateQuiz("normal")} className="gap-2">
                <Brain className="w-4 h-4" /> Gerar quiz
              </Button>
              {hasPreviousErrors && (
                <Button onClick={() => generateQuiz("review_errors")} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Revisar erros ({topic.quizErrors.length})
                </Button>
              )}
            </div>
            {hasPreviousErrors && (
              <p className="text-xs text-muted-foreground">
                Modo revisão: Flora gera questões novas focadas no que você errou antes.
              </p>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Flora está preparando suas perguntas...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8 space-y-4">
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => generateQuiz()} variant="outline">Tentar de novo</Button>
          </div>
        )}

        {q && !finished && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Pergunta {currentQ + 1} de {questions.length}</span>
                <span className="flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-secondary" />
                  {score} acerto{score !== 1 ? "s" : ""}
                </span>
              </div>
              <Progress value={((currentQ + (selectedAnswer !== null ? 1 : 0)) / questions.length) * 100} className="h-1.5" />
            </div>

            <MathText className="font-medium">{q.pergunta}</MathText>

            <div className="space-y-2">
              {q.alternativas.map((alt, i) => {
                const normalizedAlt = alt.replace(/^\s*[A-E]\)\s*/i, "").trim();
                let style = "border-border hover:border-primary/40 hover:bg-primary/5";
                if (selectedAnswer !== null) {
                  if (i === q.correta) style = "border-secondary bg-secondary/10 text-foreground";
                  else if (i === selectedAnswer) style = "border-destructive bg-destructive/10 text-foreground";
                  else style = "border-border opacity-50";
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={selectedAnswer !== null}
                    className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all ${style}`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + i)})</span>
                    <MathText inline>{normalizedAlt}</MathText>
                  </button>
                );
              })}
            </div>

            {selectedAnswer !== null && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg text-sm ${selectedAnswer === q.correta ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                  {selectedAnswer === q.correta ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Correto!
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> Incorreto
                    </div>
                  )}
                </div>
                <MathText className="text-sm text-muted-foreground">{q.explicacao}</MathText>
                <Button onClick={nextQuestion} size="sm">
                  {currentQ + 1 >= questions.length ? "Ver resultado" : "Proxima"}
                </Button>
              </div>
            )}
          </div>
        )}

        {finished && (
          <div className="text-center py-6 space-y-4">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-heading font-bold
              ${score >= questions.length * 0.7 ? "bg-secondary/15 text-secondary" : score >= questions.length * 0.4 ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}
            >
              {score}/{questions.length}
            </div>
            <p className="font-heading font-semibold text-lg">
              {score === questions.length
                ? "Perfeito! Gabaritou!"
                : score >= questions.length * 0.8
                  ? `Boa! Tu acertou ${score}/${questions.length}. Ta dominando ${topic?.tema || "esse tema"}.`
                  : score >= questions.length * 0.6
                    ? `Bom! ${score}/${questions.length}. Ta melhorando, continua assim.`
                    : score >= questions.length * 0.4
                      ? `${score}/${questions.length}. Quase lá. Revisa os pontos que errou e tenta de novo.`
                      : `${score}/${questions.length}. Sem stress — revisa o conteúdo e volta mais forte.`}
            </p>

            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-3 py-1 text-sm font-semibold text-secondary">
              <Trophy className="w-4 h-4" />
              +{calculateQuizXp(difficulty, score, questions.length)} XP ganhos
              <span className="text-xs font-normal opacity-70">
                ({difficulty} ×{QUIZ_DIFFICULTY_MULTIPLIER[difficulty]})
              </span>
            </div>

            {/* Flora adaptive feedback */}
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3 text-left">
              <Brain className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-primary text-xs mb-1">Flora diz:</p>
                <p className="text-muted-foreground">{getFloraFeedback(questions.length > 0 ? score / questions.length : 0).message}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Próxima dificuldade: <span className="font-medium text-foreground">{getFloraFeedback(questions.length > 0 ? score / questions.length : 0).nextDifficulty}</span>
                </p>
              </div>
            </div>

            {wrongQuestions.length > 0 && (
              <div className="text-left bg-muted rounded-lg p-3 text-xs space-y-1">
                <p className="font-semibold text-muted-foreground">Pontos pra revisar:</p>
                {wrongQuestions.slice(0, 3).map((q, i) => (
                  <p key={i} className="text-muted-foreground">• {q.length > 80 ? q.slice(0, 80) + "..." : q}</p>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Resultado salvo automaticamente.</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={() => generateQuiz()} variant="outline" className="gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Tentar de novo ({difficulty})
              </Button>
              <Button onClick={() => { onClose(); resetQuiz(); }}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
