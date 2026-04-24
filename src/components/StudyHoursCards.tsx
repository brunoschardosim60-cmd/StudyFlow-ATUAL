import { useEffect, useState } from "react";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { StudySession } from "@/lib/studyData";
import { loadNumberStorage } from "@/lib/storage";

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sessionLocalDate(start: string): string {
  // Parse ISO string to local date
  return toLocalDate(new Date(start));
}

function getWeekData(sessions: StudySession[], monday: Date) {
  const data = DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toLocalDate(d);
    let totalMs = 0;
    for (const s of sessions) {
      if (!s.durationMs) continue;
      if (sessionLocalDate(s.start) === dateStr) totalMs += s.durationMs;
    }
    return {
      day: label,
      date: dateStr,
      hours: Math.round((totalMs / 3600000) * 10) / 10,
    };
  });
  return data;
}

interface StudyHoursCardsProps {
  todayHours: number;
  weekHours: number;
  monthHours: number;
  sessions: StudySession[];
}

export function StudyHoursCards({ todayHours, weekHours, monthHours, sessions }: StudyHoursCardsProps) {
  const [weekOffset, setWeekOffset] = useState(() => {
    if (typeof window === "undefined") return 0;
    return loadNumberStorage("studyflow.weekOffset") ?? 0;
  });

  useEffect(() => {
    window.localStorage.removeItem("studyflow.excludeWeekends");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("studyflow.weekOffset", String(weekOffset));
  }, [weekOffset]);

  const currentMonday = getMonday(new Date());
  const viewMonday = new Date(currentMonday);
  viewMonday.setDate(currentMonday.getDate() + weekOffset * 7);

  const weekData = getWeekData(sessions, viewMonday);
  const weekTotal = Math.round(weekData.reduce((s, d) => s + d.hours, 0) * 10) / 10;
  const todayStr = toLocalDate(new Date());
  const isCurrentWeek = weekOffset === 0;

  const summaryItems = [
    { label: "Hoje", value: `${todayHours}h` },
    { label: "Semana", value: `${weekTotal}h` },
    { label: "Mês", value: `${monthHours}h` },
  ];

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Clock className="w-5 h-5 text-accent" />
        <span className="text-sm font-heading font-semibold text-muted-foreground">Tempo estudado</span>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-4 ml-0 sm:ml-auto w-full sm:w-auto">
          {summaryItems.map((item) => (
            <div key={item.label} className="text-center min-w-0 sm:min-w-[64px]">
              <p className="text-lg font-heading font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground">
          {isCurrentWeek ? "Esta semana" : formatWeekLabel(viewMonday)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-7 sm:w-7"
          onClick={() => setWeekOffset((o) => o + 1)}
          disabled={weekOffset >= 0}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <div style={{ height: 160, minWidth: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekData} barCategoryGap="20%">
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={30}
              tickFormatter={(v) => `${v}h`}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value: number) => [`${value}h`, "Tempo estudado"]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
              {weekData.map((entry) => (
                <Cell
                  key={entry.date}
                  fill={entry.date === todayStr ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
