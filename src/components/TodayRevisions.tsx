import { StudyTopic } from "@/lib/studyData";
import { isPastDateLocal } from "@/lib/dateUtils";
import { SubjectBadge } from "./SubjectBadge";
import { CheckCircle2, Clock } from "lucide-react";

interface TodayRevisionsProps {
  revisions: { topic: StudyTopic; revisionIndex: number }[];
  onComplete: (topicId: string, revisionIndex: number) => void;
}

export function TodayRevisions({ revisions, onComplete }: TodayRevisionsProps) {
  const prioritized = [...revisions].sort((a, b) => {
    const ratingDiff = a.topic.rating - b.topic.rating;
    if (ratingDiff !== 0) return ratingDiff;
    return a.topic.studyDate.localeCompare(b.topic.studyDate);
  });

  if (revisions.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-secondary mx-auto mb-2" />
        <p className="font-heading font-semibold">Tudo em dia!</p>
        <p className="text-sm text-muted-foreground">Nenhuma revisão pendente para hoje.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Clock className="w-5 h-5 text-accent" />
        <h3 className="font-heading font-semibold text-lg">Revisões de hoje</h3>
        <span className="sm:ml-auto bg-accent/10 text-accent text-xs font-bold px-2.5 py-1 rounded-full">
          {revisions.length} pendente{revisions.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-3">
        {prioritized.map(({ topic, revisionIndex }) => {
          const overdueCount = topic.revisions.reduce((acc, revision) => {
            if (!revision.scheduledDate || revision.completed) return acc;
            return isPastDateLocal(revision.scheduledDate) ? acc + 1 : acc;
          }, 0);

          return (
          <div
            key={`${topic.id}-${revisionIndex}`}
            className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <button
              onClick={() => onComplete(topic.id, revisionIndex)}
              className="w-11 h-11 sm:w-6 sm:h-6 rounded-full border-2 border-primary/30 hover:border-primary hover:bg-primary/10 transition-all flex items-center justify-center shrink-0"
            >
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{topic.tema}</p>
              <p className="text-xs text-muted-foreground">Revisão R{revisionIndex + 1} · Domínio {topic.rating}/5</p>
              {overdueCount > 0 && (
                <p className="text-xs text-destructive">{overdueCount} atrasada{overdueCount > 1 ? "s" : ""} neste tema</p>
              )}
            </div>
            <div className="ml-auto sm:ml-0">
              <SubjectBadge subject={topic.materia} />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
