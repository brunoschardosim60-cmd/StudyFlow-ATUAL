import { StudyTopic } from "@/lib/studyData";
import { daysDiffFromToday, toHumanRelativeDay } from "@/lib/dateUtils";
import { SubjectBadge } from "./SubjectBadge";
import { CalendarClock } from "lucide-react";

interface UpcomingRevisionsProps {
  revisions: { topic: StudyTopic; revisionIndex: number; date: string }[];
}

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function UpcomingRevisions({ revisions }: UpcomingRevisionsProps) {
  if (revisions.length === 0) return null;

  const groups = {
    amanha: revisions.filter((r) => daysDiffFromToday(r.date) === 1),
    proximos3: revisions.filter((r) => {
      const diff = daysDiffFromToday(r.date);
      return diff >= 2 && diff <= 3;
    }),
    semana: revisions.filter((r) => daysDiffFromToday(r.date) > 3),
  };

  const sections = [
    { key: "amanha", title: "Amanha", items: groups.amanha },
    { key: "proximos3", title: "Proximos 3 dias", items: groups.proximos3 },
    { key: "semana", title: "Resto da semana", items: groups.semana },
  ];

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <CalendarClock className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Próximas revisões</h3>
        <span className="sm:ml-auto bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
          {revisions.length} nos próximos 7 dias
        </span>
      </div>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {sections.map((section) => {
          if (section.items.length === 0) return null;
          return (
            <div key={section.key} className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground px-1">
                {section.title}
              </p>
              {section.items.map(({ topic, revisionIndex, date }) => (
            <div
              key={`${topic.id}-${revisionIndex}`}
              className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] text-center font-bold text-primary leading-tight px-1">{capitalizeFirst(toHumanRelativeDay(date))}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{topic.tema}</p>
                <p className="text-xs text-muted-foreground">R{revisionIndex + 1} · {formatDate(date)}</p>
              </div>
              <div className="ml-auto sm:ml-0">
                <SubjectBadge subject={topic.materia} />
              </div>
            </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
