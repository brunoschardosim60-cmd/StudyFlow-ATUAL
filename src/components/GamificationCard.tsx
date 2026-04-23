interface GamificationCardProps {
  streak: number;
  xp: number;
  level: number;
  todayStudyMinutes: number;
  todayRevisions: number;
  todayQuizCount: number;
  goals: {
    studyMinutes: number;
    revisions: number;
    quizCount: number;
  };
}

export function GamificationCard(props: GamificationCardProps) {
  const {
    streak,
    xp,
    level,
    todayStudyMinutes,
    todayRevisions,
    todayQuizCount,
    goals,
  } = props;

  const nextLevelXp = level * 100;
  const currentLevelBase = (level - 1) * 100;
  const progress = xp - currentLevelBase;
  const progressMax = nextLevelXp - currentLevelBase;
  const progressPercent = Math.max(0, Math.min(100, (progress / progressMax) * 100));

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Seu progresso</p>
          <h2 className="text-2xl font-bold">🔥 {streak} dias seguidos</h2>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-muted-foreground">Nível</p>
          <p className="text-2xl font-bold">{level}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>XP</span>
          <span>
            {progress}/{progressMax}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-muted-foreground">Tempo</p>
          <p className="font-semibold">
            {todayStudyMinutes}/{goals.studyMinutes} min
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-muted-foreground">Revisadas</p>
          <p className="font-semibold">
            {todayRevisions}/{goals.revisions}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-muted-foreground">Quiz</p>
          <p className="font-semibold">
            {todayQuizCount}/{goals.quizCount}
          </p>
        </div>
      </div>
    </div>
  );
}
