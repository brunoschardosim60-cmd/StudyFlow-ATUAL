import { StudyTopic } from "@/lib/studyData";
import { daysDiffFromToday } from "@/lib/dateUtils";
import { SubjectBadge } from "./SubjectBadge";
import { Button } from "./ui/button";
import { AlertTriangle } from "lucide-react";

interface OverdueRevisionsProps {
  revisions: { topic: StudyTopic; revisionIndex: number; date: string }[];
  onComplete: (topicId: string, revisionIndex: number) => void;
  onReschedule: (topicId: string, revisionIndex: number) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function daysOverdue(date: string) {
  return Math.abs(daysDiffFromToday(date));
}

function severityClasses(days: number) {
  if (days >= 8) return "border-destructive bg-destructive/15";
  if (days >= 3) return "border-destructive/60 bg-destructive/10";
  return "border-destructive/40 bg-destructive/5";
}

export function OverdueRevisions({ revisions, onComplete, onReschedule }: OverdueRevisionsProps) {
  if (revisions.length === 0) return null;

  return (
    <div className="glass-card rounded-xl p-5 border-destructive/30">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h3 className="font-heading font-semibold text-lg">Revisões atrasadas</h3>
        <span className="sm:ml-auto bg-destructive/10 text-destructive text-xs font-bold px-2.5 py-1 rounded-full">
          {revisions.length} atrasada{revisions.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {revisions.map(({ topic, revisionIndex, date }) => {
          const overdueDays = daysOverdue(date);
          return (
          <div
            key={`${topic.id}-${revisionIndex}`}
            className={`flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg border transition-colors ${severityClasses(overdueDays)}`}
          >
            <button
              onClick={() => onComplete(topic.id, revisionIndex)}
              className="w-11 h-11 sm:w-6 sm:h-6 rounded-full border-2 border-destructive/40 hover:border-destructive hover:bg-destructive/10 transition-all flex items-center justify-center shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{topic.tema}</p>
              <p className="text-xs text-destructive/70">
                R{revisionIndex + 1} · {formatDate(date)} · {overdueDays} dia{overdueDays > 1 ? "s" : ""} atrasado
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReschedule(topic.id, revisionIndex)}
              className="h-9 w-full sm:w-auto order-3 sm:order-none"
            >
              Reagendar
            </Button>
            <div className="order-2 sm:order-none ml-auto sm:ml-0">
              <SubjectBadge subject={topic.materia} />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
