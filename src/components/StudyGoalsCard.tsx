import { useState } from "react";
import { Target, Settings2, TrendingUp, BookCheck, Layers, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { StudyGoals } from "@/hooks/useStudyGoals";
import type { StudySession, StudyTopic } from "@/lib/studyData";

interface GoalItemProps {
  icon: React.ElementType;
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}

function GoalItem({ icon: Icon, label, current, target, unit, color }: GoalItemProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const achieved = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={`text-sm font-heading font-bold ${achieved ? "text-secondary" : ""}`}>
          {current}/{target}{unit}
        </span>
      </div>
      <Progress
        value={pct}
        className="h-2.5"
      />
      {achieved && (
        <p className="text-xs text-secondary font-medium">Meta atingida!</p>
      )}
    </div>
  );
}

interface StudyGoalsCardProps {
  goals: StudyGoals;
  sessions: StudySession[];
  topics: StudyTopic[];
  isLoggedIn: boolean;
  onSaveGoals: (goals: StudyGoals) => Promise<void>;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekHours(sessions: StudySession[]): number {
  const monday = getMonday(new Date());
  const mondayStr = monday.toISOString().split("T")[0];
  let totalMs = 0;
  for (const s of sessions) {
    if (!s.durationMs || s.start < mondayStr) continue;
    totalMs += s.durationMs;
  }
  return Math.round((totalMs / 3_600_000) * 10) / 10;
}

function getMonthHours(sessions: StudySession[]): number {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  let totalMs = 0;
  for (const s of sessions) {
    if (!s.durationMs || s.start < monthStart) continue;
    totalMs += s.durationMs;
  }
  return Math.round((totalMs / 3_600_000) * 10) / 10;
}

function getWeekRevisions(topics: StudyTopic[]): number {
  const monday = getMonday(new Date());
  const mondayStr = monday.toISOString().split("T")[0];
  let count = 0;
  for (const t of topics) {
    for (const r of t.revisions) {
      if (r.completed && r.scheduledDate && r.scheduledDate >= mondayStr) count++;
    }
  }
  return count;
}

function getWeekNewTopics(topics: StudyTopic[]): number {
  const monday = getMonday(new Date());
  const mondayStr = monday.toISOString().split("T")[0];
  return topics.filter((t) => t.studyDate >= mondayStr).length;
}

export function StudyGoalsCard({ goals, sessions, topics, isLoggedIn, onSaveGoals }: StudyGoalsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(goals);

  if (!isLoggedIn) return null;

  const weekHours = getWeekHours(sessions);
  const monthHours = getMonthHours(sessions);
  const weekRevisions = getWeekRevisions(topics);
  const weekTopics = getWeekNewTopics(topics);

  const handleSave = async () => {
    await onSaveGoals(form);
    setDialogOpen(false);
    toast.success("Metas atualizadas!");
  };

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <span className="text-sm font-heading font-semibold text-muted-foreground">Minhas Metas</span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setForm(goals)}>
              <Settings2 className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar Metas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Horas por semana</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.weeklyHoursTarget}
                  onChange={(e) => setForm((f) => ({ ...f, weeklyHoursTarget: Number(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Horas por mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={form.monthlyHoursTarget}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyHoursTarget: Number(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Revisões por semana</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.weeklyRevisionsTarget}
                  onChange={(e) => setForm((f) => ({ ...f, weeklyRevisionsTarget: Number(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Novos temas por semana</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.weeklyTopicsTarget}
                  onChange={(e) => setForm((f) => ({ ...f, weeklyTopicsTarget: Number(e.target.value) || 1 }))}
                />
              </div>
              <Button onClick={handleSave} className="w-full">
                Salvar Metas
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GoalItem
          icon={Clock}
          label="Horas/Semana"
          current={weekHours}
          target={goals.weeklyHoursTarget}
          unit="h"
          color="text-primary"
        />
        <GoalItem
          icon={TrendingUp}
          label="Horas/Mês"
          current={monthHours}
          target={goals.monthlyHoursTarget}
          unit="h"
          color="text-accent"
        />
        <GoalItem
          icon={BookCheck}
          label="Revisões/Semana"
          current={weekRevisions}
          target={goals.weeklyRevisionsTarget}
          unit=""
          color="text-secondary"
        />
        <GoalItem
          icon={Layers}
          label="Temas/Semana"
          current={weekTopics}
          target={goals.weeklyTopicsTarget}
          unit=""
          color="text-subject-chem"
        />
      </div>
    </div>
  );
}
