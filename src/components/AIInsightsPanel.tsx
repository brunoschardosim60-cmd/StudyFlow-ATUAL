import { useState, useEffect, useCallback } from "react";
import { Brain, TrendingUp, Target, BookOpen, Zap, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserProfile {
  studyGoal: string;
  studyHours: number;
  preferredSubjects: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface AIInsight {
  type: 'performance' | 'recommendation' | 'motivation' | 'warning';
  title: string;
  description: string;
  action?: string;
  priority: 'low' | 'medium' | 'high';
}

export function AIInsightsPanel() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const generateInsights = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Buscar dados do usuário
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      const { data: topics } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', user.id);

      // Análise inteligente dos dados
      const newInsights: AIInsight[] = [];

      // Análise de performance
      if (sessions && sessions.length > 0) {
        const recentSessions = sessions.slice(0, 7);
        const avgDaily = recentSessions.reduce((sum, s) => sum + s.duration_minutes, 0) / 7;

        if (avgDaily < 30) {
          newInsights.push({
            type: 'warning',
            title: 'Tempo de estudo baixo',
            description: `Você estudou apenas ${Math.round(avgDaily)} minutos por dia esta semana. Tente aumentar para pelo menos 45 minutos diários.`,
            action: 'Criar cronograma',
            priority: 'high'
          });
        } else if (avgDaily > 120) {
          newInsights.push({
            type: 'performance',
            title: 'Excelente dedicação!',
            description: `Você manteve uma média de ${Math.round(avgDaily)} minutos diários. Continue assim!`,
            priority: 'medium'
          });
        }
      }

      // Análise de assuntos
      if (topics && topics.length > 0) {
        const subjectCount = topics.length;
        const avgPriority = topics.reduce((sum, t) => sum + (t.priority || 0), 0) / subjectCount;

        if (subjectCount < 3) {
          newInsights.push({
            type: 'recommendation',
            title: 'Diversifique seus estudos',
            description: 'Você tem poucos assuntos cadastrados. Adicione mais tópicos para um estudo mais completo.',
            action: 'Adicionar assunto',
            priority: 'medium'
          });
        }

        if (avgPriority > 7) {
          newInsights.push({
            type: 'motivation',
            title: 'Foco nos prioritários',
            description: 'Seus assuntos têm alta prioridade. Ótimo foco! Mantenha o ritmo.',
            priority: 'low'
          });
        }
      }

      // Recomendações baseadas no perfil
      if (profile?.studyGoal) {
        if (profile.studyGoal.includes('enem') || profile.studyGoal.includes('vestibular')) {
          newInsights.push({
            type: 'recommendation',
            title: 'Preparação ENEM',
            description: 'Para o ENEM, foque em redações semanais e revisões sistemáticas. Que tal criar um plano específico?',
            action: 'Ver redações',
            priority: 'medium'
          });
        }
      }

      // Motivação baseada no progresso
      const today = new Date().toDateString();
      const todaySessions = sessions?.filter(s => new Date(s.created_at).toDateString() === today) || [];

      if (todaySessions.length === 0) {
        newInsights.push({
          type: 'motivation',
          title: 'Que tal começar hoje?',
          description: 'Você ainda não estudou hoje. Mesmo 15 minutos fazem diferença!',
          action: 'Iniciar estudo',
          priority: 'high'
        });
      } else {
        newInsights.push({
          type: 'motivation',
          title: 'Mantendo o ritmo!',
          description: `Você já estudou ${todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0)} minutos hoje. Parabéns!`,
          priority: 'low'
        });
      }

      setInsights(newInsights.slice(0, 4)); // Máximo 4 insights
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    generateInsights();
  }, [generateInsights]);

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'performance': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'recommendation': return <Target className="w-4 h-4 text-blue-500" />;
      case 'motivation': return <Award className="w-4 h-4 text-yellow-500" />;
      case 'warning': return <Zap className="w-4 h-4 text-red-500" />;
    }
  };

  const getPriorityColor = (priority: AIInsight['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      case 'medium': return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950';
      case 'low': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Insights da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Insights da IA
          <Badge variant="secondary" className="text-xs">
            {insights.length} insights
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Comece a estudar para receber insights personalizados!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getPriorityColor(insight.priority)} transition-all hover:shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                    {insight.action && (
                      <Button size="sm" variant="outline" className="h-6 text-xs">
                        {insight.action}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
