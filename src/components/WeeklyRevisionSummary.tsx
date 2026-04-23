import { getWeekRevisionSummary, StudyTopic } from "@/lib/studyData";
import { CalendarRange } from "lucide-react";

interface Props {
  topics: StudyTopic[];
}

const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function WeeklyRevisionSummary({ topics }: Props) {
  const { total, done, byDay, startStr, endStr } = getWeekRevisionSummary(topics);

  if (total === 0) return null;

  // Build array of days Mon-Sun
  const start = new Date(startStr + "T12:00:00");
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <CalendarRange className="w-5 h-5 text-secondary" />
        <h3 className="font-heading font-semibold text-lg">Revisão da semana</h3>
        <span className="sm:ml-auto text-xs text-muted-foreground">
          {done}/{total} concluídas
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[420px]">
        {days.map((date, i) => {
          const day = byDay[date] || { total: 0, done: 0 };
          const pct = day.total > 0 ? (day.done / day.total) * 100 : 0;
          const isToday = date === new Date().toISOString().split("T")[0];

          return (
            <div
              key={date}
              className={`text-center p-2 rounded-lg ${isToday ? "ring-2 ring-primary/40 bg-primary/5" : "bg-muted/30"}`}
            >
              <p className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {DAYS_PT[i]}
              </p>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-1">
                <div
                  className="h-full rounded-full bg-secondary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {day.done}/{day.total}
              </p>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
