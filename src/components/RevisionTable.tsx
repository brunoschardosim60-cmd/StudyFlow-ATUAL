import { StudyTopic, REVISION_INTERVALS } from "@/lib/studyData";
import { isPastDateLocal } from "@/lib/dateUtils";
import { SubjectBadge } from "./SubjectBadge";
import { StarRating } from "./StarRating";
import { Check, Trash2, StickyNote, Brain, PlayCircle } from "lucide-react";

interface RevisionTableProps {
  topics: StudyTopic[];
  onToggleRevision: (topicId: string, index: number) => void;
  onRatingChange: (topicId: string, rating: number) => void;
  onDelete: (topicId: string) => void;
  onOpenNotes: (topic: StudyTopic) => void;
  onOpenQuiz: (topic: StudyTopic) => void;
  onStartStudy: (topic: StudyTopic) => void;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isOverdue(iso: string | null) {
  return isPastDateLocal(iso);
}

export function RevisionTable({ topics, onToggleRevision, onRatingChange, onDelete, onOpenNotes, onOpenQuiz, onStartStudy }: RevisionTableProps) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto px-1 sm:px-0">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-heading font-semibold">Tema</th>
              <th className="text-left p-3 font-heading font-semibold">Matéria</th>
              <th className="text-center p-3 font-heading font-semibold">Dia estudado</th>
              {REVISION_INTERVALS.map((d, i) => (
                <th key={i} className="text-center p-3 font-heading font-semibold whitespace-nowrap">
                  R{i + 1} <span className="text-xs text-muted-foreground font-normal">({d}d)</span>
                </th>
              ))}
              <th className="text-center p-3 font-heading font-semibold">Domínio</th>
              <th className="p-3 font-heading font-semibold text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {topics.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center">
                  <div className="mx-auto max-w-md space-y-2">
                    <p className="font-heading text-lg font-semibold">Seu cronograma ainda está vazio</p>
                    <p className="text-sm text-muted-foreground">
                      Adicione o primeiro tema acima para começar a montar revisões, anotações, quiz e sessões de estudo sem dados de exemplo misturados ao seu progresso real.
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {topics.map((topic) => (
              <tr
                key={topic.id}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors"
              >
                <td className="p-3 font-medium max-w-[260px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{topic.tema}</span>
                    {topic.skipWeekendsRevisions && (
                      <span className="shrink-0 rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold">
                        sem fim de semana
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3"><SubjectBadge subject={topic.materia} /></td>
                <td className="p-3 text-center text-muted-foreground text-xs">{formatDate(topic.studyDate)}</td>
                {topic.revisions.map((revision, i) => (
                  <td key={i} className="p-3 text-center">
                    <button
                      onClick={() => onToggleRevision(topic.id, i)}
                      className={`w-11 h-11 sm:w-7 sm:h-7 rounded-md border-2 transition-all flex items-center justify-center mx-auto
                        ${revision.completed
                          ? "bg-secondary border-secondary text-secondary-foreground"
                          : isOverdue(revision.scheduledDate) && !revision.completed
                            ? "border-destructive/50 bg-destructive/5"
                            : "border-border hover:border-primary/50"
                        }`}
                    >
                      {revision.completed && <Check className="w-4 h-4" />}
                    </button>
                    <p className={`text-[10px] mt-1 ${isOverdue(revision.scheduledDate) && !revision.completed ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatDate(revision.scheduledDate)}
                    </p>
                  </td>
                ))}
                <td className="p-3">
                  <StarRating rating={topic.rating} onChange={(r) => onRatingChange(topic.id, r)} />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-center">
                    <button
                      onClick={() => onStartStudy(topic)}
                      title="Estudar agora"
                      className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-md text-muted-foreground hover:text-secondary hover:bg-secondary/10 transition-all"
                    >
                      <PlayCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenNotes(topic)}
                      title="Anotações e Flashcards"
                      className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                    >
                      <StickyNote className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenQuiz(topic)}
                      title="Quiz com IA"
                      className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
                    >
                      <Brain className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(topic.id)}
                      title="Excluir"
                      className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
