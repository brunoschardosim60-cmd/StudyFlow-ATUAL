import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Target, TrendingUp } from "lucide-react";

interface DailyGoalCard {
  id: "minutes" | "revisions" | "quiz";
  label: string;
  current: number;
  target: number;
  unit: string;
}

interface DashboardHeroProps {
  firstName?: string;
  isLoggedIn: boolean;
  streakDays: number;
  weeklyProgressPercent: number;
  weeklyCompleted: number;
  weeklyTotal: number;
  dailyGoals: DailyGoalCard[];
  todayMinutes: number;
  revisionsCompletedToday: number;
  comebackMode: boolean;
  onPrimaryAction: () => void;
  primaryLabel: string;
}

function greetingLabel(firstName: string | undefined, isLoggedIn: boolean) {
  if (!isLoggedIn) return "Pronto para estudar?";
  return firstName ? `Bom te ver, ${firstName}` : "Bom te ver";
}

export function DashboardHero({
  firstName,
  isLoggedIn,
  streakDays,
  weeklyProgressPercent,
  weeklyCompleted,
  weeklyTotal,
  dailyGoals,
  todayMinutes,
  revisionsCompletedToday,
  comebackMode,
  onPrimaryAction,
  primaryLabel,
}: DashboardHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/12 via-card to-accent/10 p-5 sm:p-7">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_55%)]" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <Badge variant="secondary" className="w-fit">
              Ritmo em dia
            </Badge>
            <div className="space-y-1">
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">{greetingLabel(firstName, isLoggedIn)}</h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                {isLoggedIn
                  ? "Hoje está tudo organizado para você seguir sem pensar demais no próximo passo."
                  : "Escolhe um bloco e começa."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <Button size="lg" className="w-full sm:w-auto sm:min-w-[180px]" onClick={onPrimaryAction}>
                {primaryLabel}
              </Button>
              <div className="w-full sm:w-auto rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs text-muted-foreground">Resumo de hoje</p>
                <p className="font-medium">
                  {todayMinutes} min estudados, {revisionsCompletedToday} revis{revisionsCompletedToday === 1 ? "ada" : "adas"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 lg:min-w-[360px] w-full lg:w-auto">
            <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Flame className="w-4 h-4 text-orange-500" />
                Streak diário
              </div>
              <p className="mt-2 font-heading text-3xl font-bold">{streakDays}</p>
              <p className="text-xs text-muted-foreground">dias seguidos com atividade</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="w-4 h-4 text-secondary" />
                Semana
              </div>
              <p className="mt-2 font-heading text-3xl font-bold">{weeklyProgressPercent}%</p>
              <p className="text-xs text-muted-foreground">{weeklyCompleted}/{weeklyTotal} revisões da semana</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <p className="font-heading font-semibold">Meta do dia</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {dailyGoals.map((goal) => {
              const percent = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
              return (
                <div key={goal.id} className="space-y-2 rounded-xl border border-border/60 bg-card/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{goal.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {goal.current}/{goal.target} {goal.unit}
                    </span>
                  </div>
                  <Progress value={percent} className="h-2.5" />
                  <p className="text-xs text-muted-foreground">
                    {percent >= 100 ? "Concluído" : `${percent}% concluído`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}