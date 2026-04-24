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

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Target, TrendingUp, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

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
  const [animatedStreak, setAnimatedStreak] = useState(0);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedStreak(streakDays), 500);
    return () => clearTimeout(timer);
  }, [streakDays]);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(weeklyProgressPercent), 700);
    return () => clearTimeout(timer);
  }, [weeklyProgressPercent]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/12 via-card to-accent/10 p-5 sm:p-7 shadow-lg hover:shadow-xl transition-shadow duration-300"
    >
      {/* Background Effects */}
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.10),transparent_55%)]" />
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-green-500/10 to-blue-500/10 rounded-full blur-3xl" />

      <div className="relative space-y-6">
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="space-y-4 max-w-2xl">
            <motion.div variants={itemVariants} className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30">
                <Sparkles className="w-3 h-3 mr-1" />
                {comebackMode ? "Bem-vindo de volta!" : "Ritmo em dia"}
              </Badge>
              {comebackMode && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1, type: "spring", stiffness: 200 }}
                >
                  <Badge variant="outline" className="border-green-500/50 text-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Retorno
                  </Badge>
                </motion.div>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-2">
              <h2 className="font-heading text-2xl font-bold sm:text-3xl bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                {greetingLabel(firstName, isLoggedIn)}
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
                {isLoggedIn
                  ? comebackMode
                    ? "Que bom ter você de volta! Vamos retomar seus estudos com tudo."
                    : "Hoje está tudo organizado para você seguir sem pensar demais no próximo passo."
                  : "Escolhe um bloco e começa."}
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3"
            >
              <Button
                size="lg"
                className="w-full sm:w-auto sm:min-w-[180px] bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                onClick={onPrimaryAction}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {primaryLabel}
              </Button>

              <motion.div
                variants={itemVariants}
                className="w-full sm:w-auto rounded-2xl border border-border/70 bg-background/80 backdrop-blur-sm px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Clock className="w-3 h-3" />
                  Resumo de hoje
                </div>
                <p className="font-medium text-sm">
                  {todayMinutes} min estudados, {revisionsCompletedToday} revis{revisionsCompletedToday === 1 ? "ada" : "adas"}
                </p>
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 lg:min-w-[360px] w-full lg:w-auto"
          >
            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              className="group rounded-2xl border border-border/70 bg-background/90 backdrop-blur-sm p-4 shadow-sm hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                <Flame className="w-4 h-4 text-orange-500 group-hover:animate-pulse" />
                Streak diário
              </div>
              <motion.p
                className="font-heading text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              >
                {animatedStreak}
              </motion.p>
              <p className="text-xs text-muted-foreground mt-1">dias seguidos com atividade</p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              className="group rounded-2xl border border-border/70 bg-background/90 backdrop-blur-sm p-4 shadow-sm hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                <TrendingUp className="w-4 h-4 text-secondary group-hover:animate-pulse" />
                Semana
              </div>
              <motion.p
                className="font-heading text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
              >
                {animatedProgress}%
              </motion.p>
              <p className="text-xs text-muted-foreground mt-1">{weeklyCompleted}/{weeklyTotal} revisões da semana</p>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-border/70 bg-background/80 backdrop-blur-sm p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <p className="font-heading font-semibold">Meta do dia</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {dailyGoals.map((goal, index) => {
              const percent = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
              const isCompleted = percent >= 100;

              return (
                <motion.div
                  key={goal.id}
                  variants={itemVariants}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className={`space-y-3 rounded-xl border bg-card/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-200 ${
                    isCompleted ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {goal.label}
                    </p>
                    <span className="text-xs text-muted-foreground font-medium">
                      {goal.current}/{goal.target} {goal.unit}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress
                      value={percent}
                      className="h-3 bg-muted/50"
                    />
                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Sparkles className="w-4 h-4 text-green-500" />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isCompleted ? (
                      <span className="text-green-600 font-medium">🎉 Concluído!</span>
                    ) : (
                      `${percent}% concluído`
                    )}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}