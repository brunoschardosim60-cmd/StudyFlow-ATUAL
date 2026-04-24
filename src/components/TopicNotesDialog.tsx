import { useState, useMemo } from "react";
import { StudyTopic, Flashcard } from "@/lib/studyData";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StickyNote, Layers, Plus, Trash2, RotateCcw, Sparkles, Loader2, CheckCircle2, Brain, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reportError } from "@/lib/errorHandling";
import { LinkNotebookDialog } from "./LinkNotebookDialog";
import { MathText } from "./MathText";

interface TopicNotesDialogProps {
  topic: StudyTopic | null;
  open: boolean;
  onClose: () => void;
  onUpdateNotes: (topicId: string, notas: string) => void;
  onUpdateFlashcards: (topicId: string, flashcards: Flashcard[]) => void;
}

interface GeneratedFlashcardPayload {
  frente: string;
  verso: string;
}

interface GenerateFlashcardsResponse {
  flashcards?: GeneratedFlashcardPayload[];
}

// SM-2 algorithm: calculate next interval based on quality (0-5)
function sm2Next(card: Flashcard, quality: number): Partial<Flashcard> {
  const currentInterval = card.intervalDays ?? 1;
  const currentStreak = card.streak ?? 0;

  if (quality < 3) {
    // Failed — reset
    return {
      intervalDays: 1,
      streak: 0,
      nextReview: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    };
  }

  let nextInterval: number;
  if (currentStreak === 0) nextInterval = 1;
  else if (currentStreak === 1) nextInterval = 3;
  else {
    const ef = Math.max(1.3, 2.5 + 0.1 * (quality - 3) - 0.08 * (5 - quality));
    nextInterval = Math.round(currentInterval * ef);
  }

  return {
    intervalDays: nextInterval,
    streak: currentStreak + 1,
    nextReview: new Date(Date.now() + nextInterval * 86400000).toISOString().split("T")[0],
  };
}

function isDueForReview(card: Flashcard): boolean {
  if (!card.nextReview) return true; // Never reviewed
  const today = new Date().toISOString().split("T")[0];
  return card.nextReview <= today;
}

export function TopicNotesDialog({ topic, open, onClose, onUpdateNotes, onUpdateFlashcards }: TopicNotesDialogProps) {
  const [tab, setTab] = useState<"notas" | "flashcards">("notas");
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  if (!topic) return null;

  const dueCards = topic.flashcards.filter(isDueForReview);

  const addFlashcard = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    const card: Flashcard = { id: crypto.randomUUID(), frente: newFront.trim(), verso: newBack.trim() };
    onUpdateFlashcards(topic.id, [...topic.flashcards, card]);
    setNewFront("");
    setNewBack("");
  };

  const removeFlashcard = (cardId: string) => {
    onUpdateFlashcards(topic.id, topic.flashcards.filter((c) => c.id !== cardId));
  };

  const toggleFlip = (cardId: string) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const handleReviewAnswer = (quality: number) => {
    const card = dueCards[reviewIndex];
    if (!card) return;
    const updates = sm2Next(card, quality);
    const updatedCards = topic.flashcards.map((c) =>
      c.id === card.id ? { ...c, ...updates } : c
    );
    onUpdateFlashcards(topic.id, updatedCards);
    setReviewFlipped(false);
    if (reviewIndex + 1 >= dueCards.length) {
      setReviewMode(false);
      setReviewIndex(0);
      toast.success("Revisão concluída!");
    } else {
      setReviewIndex((i) => i + 1);
    }
  };

  const startReview = () => {
    setReviewMode(true);
    setReviewIndex(0);
    setReviewFlipped(false);
  };

  const generateFlashcards = async () => {
    setGenerating(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      const { data, error } = await supabase.functions.invoke<GenerateFlashcardsResponse>("flora-engine", {
        body: {
          action: "generate_flashcards",
          userId: userId || "anonymous",
          data: {
            materia: topic.materia,
            tema: topic.tema,
            pageContent: topic.notas,
          },
        },
      });
      if (error) throw error;
      const cards: Flashcard[] = (data?.flashcards || []).map((card) => ({
        id: crypto.randomUUID(),
        frente: card.frente,
        verso: card.verso,
      }));

      const map = new Map<string, Flashcard>();
      [...topic.flashcards, ...cards].forEach((card) => {
        const key = `${card.frente.trim().toLowerCase()}::${card.verso.trim().toLowerCase()}`;
        if (!map.has(key)) map.set(key, card);
      });
      const nextCards = Array.from(map.values());

      onUpdateFlashcards(topic.id, nextCards);

      // Agenda revisões espaçadas (1, 3, 7, 15 dias) para entrar no dashboard
      if (userId && cards.length > 0) {
        const { scheduleSpacedReviews } = await import("@/lib/spacedReviews");
        const result = await scheduleSpacedReviews(userId, topic.id, topic.materia);
        if (result.created > 0) {
          toast.success(`${cards.length} flashcards criados. Revisões agendadas para 1, 3, 7 e 15 dias.`);
        } else {
          toast.success(`${cards.length} flashcards prontos para revisar.`);
        }
      } else {
        toast.success(`${cards.length} flashcards prontos para revisar.`);
      }
    } catch (e) {
      reportError("Erro ao gerar flashcards do topico:", e, { devOnly: true });
      toast.error("Erro ao gerar flashcards.");
    } finally {
      setGenerating(false);
    }
  };

  // Review mode UI
  const renderReviewMode = () => {
    const card = dueCards[reviewIndex];
    if (!card) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Card {reviewIndex + 1} de {dueCards.length}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setReviewMode(false)}>
            Sair da revisão
          </Button>
        </div>

        <div
          onClick={() => setReviewFlipped(!reviewFlipped)}
          className="cursor-pointer min-h-[200px] relative"
          style={{ perspective: "1000px" }}
        >
          <div
            className="relative w-full min-h-[200px] transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: reviewFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-xl border-2 p-6 bg-primary/5 border-primary/20 overflow-hidden"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="flex h-full min-h-0 flex-col items-center text-center">
                <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-semibold shrink-0">Pergunta</p>
                <div className="flex-1 min-h-0 w-full overflow-y-auto pr-1">
                  <MathText className="font-medium text-lg leading-snug">{card.frente}</MathText>
                </div>
                <p className="text-xs text-muted-foreground mt-3 shrink-0">Clique para ver a resposta</p>
              </div>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 rounded-xl border-2 p-6 bg-secondary/10 border-secondary/30 overflow-hidden"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="flex h-full min-h-0 flex-col items-center text-center">
                <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-semibold shrink-0">Resposta</p>
                <div className="flex-1 min-h-0 w-full overflow-y-auto pr-1">
                  <MathText className="font-medium text-lg leading-snug">{card.verso}</MathText>
                </div>
              </div>
            </div>
          </div>
        </div>

        {reviewFlipped && (
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => handleReviewAnswer(1)}
              className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Errei
            </Button>
            <Button
              variant="outline"
              onClick={() => handleReviewAnswer(3)}
              className="flex-1 border-accent/30 text-accent hover:bg-accent/10"
            >
              Difícil
            </Button>
            <Button
              variant="outline"
              onClick={() => handleReviewAnswer(4)}
              className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
            >
              Bom
            </Button>
            <Button
              variant="outline"
              onClick={() => handleReviewAnswer(5)}
              className="flex-1 border-secondary/30 text-secondary hover:bg-secondary/10"
            >
              Fácil
            </Button>
          </div>
        )}

        {card.intervalDays && (
          <p className="text-xs text-center text-muted-foreground">
            Intervalo atual: {card.intervalDays} dia{card.intervalDays > 1 ? "s" : ""} · Sequência: {card.streak ?? 0}
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-primary" />
            {topic.tema}
          </DialogTitle>
          <DialogDescription>
            Edite as anotações e organize os flashcards deste tema em um único lugar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("notas")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${tab === "notas" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <StickyNote className="w-3.5 h-3.5" /> Anotações
          </button>
          <button
            onClick={() => { setTab("flashcards"); setReviewMode(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${tab === "flashcards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <Layers className="w-3.5 h-3.5" /> Flashcards ({topic.flashcards.length})
            {dueCards.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                {dueCards.length}
              </span>
            )}
          </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLinkOpen(true)}
            className="gap-1.5 ml-auto"
          >
            <Link2 className="w-3.5 h-3.5" /> Vincular caderno
          </Button>
        </div>

        {tab === "notas" ? (
          <Textarea
            value={topic.notas}
            onChange={(e) => onUpdateNotes(topic.id, e.target.value)}
            placeholder="Escreva aqui os pontos principais deste tema..."
            className="min-h-[200px] resize-none"
          />
        ) : reviewMode ? (
          renderReviewMode()
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder="Frente do card"
              />
              <Input
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="Verso do card"
                onKeyDown={(e) => e.key === "Enter" && addFlashcard()}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={addFlashcard} size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Adicionar flashcard
              </Button>
              <Button onClick={generateFlashcards} size="sm" variant="outline" disabled={generating} className="gap-1.5">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Gerar automaticamente
              </Button>
              {dueCards.length > 0 && (
                <Button onClick={startReview} size="sm" variant="secondary" className="gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> Revisar ({dueCards.length} pendentes)
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topic.flashcards.map((card) => {
                const flipped = flippedCards.has(card.id);
                const due = isDueForReview(card);
                return (
                  <div
                    key={card.id}
                    onClick={() => toggleFlip(card.id)}
                    className="relative cursor-pointer group"
                    style={{ perspective: "800px" }}
                  >
                    <div
                      className="relative w-full min-h-[120px] transition-transform duration-500"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 p-4 rounded-xl border-2 bg-primary/5 border-primary/20 hover:border-primary/40 transition-colors overflow-hidden"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className="flex h-full min-h-0 flex-col items-center text-center">
                          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold shrink-0">Pergunta</p>
                          <div className="flex-1 min-h-0 w-full overflow-y-auto px-1 pr-2 scrollbar-minimal">
                            <MathText className="font-medium text-sm leading-snug">{card.frente}</MathText>
                          </div>
                          {due && (
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                              Revisar
                            </span>
                          )}
                          {card.streak != null && card.streak > 0 && (
                            <span className="absolute bottom-2 left-2 text-[9px] text-muted-foreground">
                              {card.streak}x · {card.intervalDays}d
                            </span>
                          )}
                          <RotateCcw className="absolute bottom-2 right-2 w-3 h-3 text-muted-foreground/40" />
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFlashcard(card.id); }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Back */}
                      <div
                        className="absolute inset-0 p-4 rounded-xl border-2 bg-secondary/10 border-secondary/30 overflow-hidden"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        <div className="flex h-full min-h-0 flex-col items-center text-center">
                          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold shrink-0">Resposta</p>
                          <div className="flex-1 min-h-0 w-full overflow-y-auto px-1 pr-2 scrollbar-minimal">
                            <MathText className="font-medium text-sm leading-snug">{card.verso}</MathText>
                          </div>
                          <RotateCcw className="absolute bottom-2 right-2 w-3 h-3 text-muted-foreground/40" />
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFlashcard(card.id); }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {topic.flashcards.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Ainda não há flashcards para este tema. Você pode criar um agora ou gerar uma primeira leva automaticamente.
              </p>
            )}
          </div>
        )}
      </DialogContent>
      <LinkNotebookDialog topic={topic} open={linkOpen} onClose={() => setLinkOpen(false)} />
    </Dialog>
  );
}
