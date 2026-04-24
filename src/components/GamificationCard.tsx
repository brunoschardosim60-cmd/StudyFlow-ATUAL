import { motion } from "framer-motion";
import { Trophy, Flame, Star, Target, Zap, Award, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";

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

  const [animatedXp, setAnimatedXp] = useState(0);
  const [animatedLevel, setAnimatedLevel] = useState(level);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const nextLevelXp = level * 100;
  const currentLevelBase = (level - 1) * 100;
  const progress = xp - currentLevelBase;
  const progressMax = nextLevelXp - currentLevelBase;
  const progressPercent = Math.max(0, Math.min(100, (progress / progressMax) * 100));

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedXp(xp), 300);
    return () => clearTimeout(timer);
  }, [xp]);

  useEffect(() => {
    if (level > animatedLevel) {
      setShowLevelUp(true);
      setTimeout(() => {
        setAnimatedLevel(level);
        setShowLevelUp(false);
      }, 2000);
    }
  }, [level, animatedLevel]);

  const getStreakBadge = (streak: number) => {
    if (streak >= 30) return { text: "Lendário", color: "bg-gradient-to-r from-purple-500 to-pink-500" };
    if (streak >= 14) return { text: "Épico", color: "bg-gradient-to-r from-orange-500 to-red-500" };
    if (streak >= 7) return { text: "Impressionante", color: "bg-gradient-to-r from-blue-500 to-purple-500" };
    if (streak >= 3) return { text: "Bom", color: "bg-gradient-to-r from-green-500 to-blue-500" };
    return { text: "Iniciante", color: "bg-gradient-to-r from-gray-500 to-gray-600" };
  };

  const streakBadge = getStreakBadge(streak);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3 }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative rounded-2xl border bg-gradient-to-br from-card to-card/80 backdrop-blur-sm p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-2xl" />

      {/* Level Up Animation */}
      {showLevelUp && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm rounded-2xl z-10"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-center"
          >
            <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-primary">LEVEL UP!</p>
            <p className="text-sm text-muted-foreground">Você alcançou o nível {level}</p>
          </motion.div>
        </motion.div>
      )}

      <div className="relative space-y-6">
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`${streakBadge.color} text-white border-0 shadow-sm`}>
                <Flame className="w-3 h-3 mr-1" />
                {streakBadge.text}
              </Badge>
              {streak >= 7 && <Award className="w-4 h-4 text-yellow-500" />}
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🔥
              </motion.div>
              {streak} dias seguidos
            </h2>
            <p className="text-sm text-muted-foreground">
              Continue assim para manter sua sequência!
            </p>
          </div>

          <motion.div
            variants={itemVariants}
            className="text-left sm:text-right space-y-1"
          >
            <div className="flex items-center gap-2 justify-start sm:justify-end">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Nível</span>
            </div>
            <motion.p
              className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text"
              animate={{ scale: showLevelUp ? [1, 1.2, 1] : 1 }}
              transition={{ duration: 0.5 }}
            >
              {animatedLevel}
            </motion.p>
          </motion.div>
        </motion.div>

        {/* XP Progress */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">Experiência</span>
            </div>
            <span className="text-muted-foreground font-medium">
              {progress}/{progressMax} XP
            </span>
          </div>
          <div className="relative">
            <Progress
              value={progressPercent}
              className="h-3 bg-muted/50 shadow-inner"
            />
            <motion.div
              className="absolute top-0 left-0 h-3 bg-gradient-to-r from-primary to-accent rounded-full shadow-sm"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            {progressPercent >= 100 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute right-0 top-1/2 transform -translate-y-1/2"
              >
                <Star className="w-4 h-4 text-yellow-500" />
              </motion.div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {progressMax - progress} XP para o próximo nível
          </p>
        </motion.div>

        {/* Daily Goals */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Objetivos de Hoje</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Tempo de Estudo",
                current: todayStudyMinutes,
                target: goals.studyMinutes,
                unit: "min",
                icon: "⏱️",
                color: "from-blue-500 to-cyan-500"
              },
              {
                label: "Revisões",
                current: todayRevisions,
                target: goals.revisions,
                unit: "",
                icon: "📚",
                color: "from-green-500 to-emerald-500"
              },
              {
                label: "Quizzes",
                current: todayQuizCount,
                target: goals.quizCount,
                unit: "",
                icon: "🧠",
                color: "from-purple-500 to-pink-500"
              }
            ].map((goal, index) => {
              const percent = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
              const isCompleted = percent >= 100;

              return (
                <motion.div
                  key={goal.label}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02 }}
                  className={`relative rounded-xl border bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm p-3 shadow-sm hover:shadow-md transition-all duration-200 ${
                    isCompleted ? 'border-green-500/30 bg-green-50/20 dark:bg-green-950/20' : 'border-border/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{goal.label}</span>
                    <span className={`text-lg ${isCompleted ? 'animate-bounce' : ''}`}>{goal.icon}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">{goal.current}</span>
                      <span className="text-xs text-muted-foreground">/{goal.target}{goal.unit}</span>
                    </div>

                    <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full bg-gradient-to-r ${goal.color} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                      />
                    </div>

                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2"
                      >
                        <TrendingUp className="w-3 h-3 text-green-500" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
