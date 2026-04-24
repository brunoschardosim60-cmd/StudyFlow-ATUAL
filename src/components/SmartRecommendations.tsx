import { useState, useEffect } from "react";
import { Lightbulb, Clock, BookOpen, Target, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SmartRecommendation {
  id: string;
  type: 'study_plan' | 'break_reminder' | 'topic_review' | 'social_learning' | 'goal_adjustment';
  title: string;
  description: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
  data?: any;
}

export function SmartRecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const generateRecommendations = async () => {
      try {
        setLoading(true);

        // Buscar dados do usuário
        const { data: sessions } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: topics } = await supabase
          .from('topics')
          .select('*')
          .eq('user_id', user.id);

        const { data: flashcards } = await supabase
          .from('flashcards')
          .select('*')
          .eq('user_id', user.id)
          .order('next_review', { ascending: true })
          .limit(20);

        const newRecommendations: SmartRecommendation[] = [];

        // Análise de padrões de estudo
        if (sessions && sessions.length > 7) {
          const lastWeek = sessions.slice(0, 7);
          const studyTimes = lastWeek.map(s => new Date(s.created_at).getHours());

          // Recomendação baseada no melhor horário
          const bestHour = studyTimes.reduce((a, b, i, arr) =>
            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
          );

          if (bestHour >= 6 && bestHour <= 10) {
            newRecommendations.push({
              id: 'morning_study',
              type: 'study_plan',
              title: 'Estudo Matinal',
              description: 'Você rende melhor pela manhã. Que tal agendar suas sessões entre 6h-10h?',
              action: 'Criar cronograma',
              priority: 'medium'
            });
          }
        }

        // Flashcards para revisar
        if (flashcards && flashcards.length > 0) {
          const dueCards = flashcards.filter(card =>
            new Date(card.next_review) <= new Date()
          );

          if (dueCards.length > 5) {
            newRecommendations.push({
              id: 'flashcard_review',
              type: 'topic_review',
              title: 'Revisão Pendente',
              description: `${dueCards.length} flashcards aguardam revisão. O espaçamento ideal está sendo perdido.`,
              action: 'Revisar agora',
              priority: 'high',
              data: { count: dueCards.length }
            });
          }
        }

        // Recomendação de pausa baseada no tempo de estudo
        if (sessions && sessions.length > 0) {
          const todaySessions = sessions.filter(s =>
            new Date(s.created_at).toDateString() === new Date().toDateString()
          );

          const totalToday = todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0);

          if (totalToday > 90) {
            newRecommendations.push({
              id: 'break_reminder',
              type: 'break_reminder',
              title: 'Hora da Pausa',
              description: `Você estudou ${totalToday} minutos hoje. Que tal uma pausa de 15 minutos para recarregar?`,
              action: 'Iniciar pausa',
              priority: 'medium'
            });
          }
        }

        // Recomendação baseada em assuntos fracos
        if (topics && sessions) {
          const topicPerformance = topics.map(topic => {
            const topicSessions = sessions.filter(s => s.topic === topic.name);
            const avgDuration = topicSessions.length > 0
              ? topicSessions.reduce((sum, s) => sum + s.duration_minutes, 0) / topicSessions.length
              : 0;

            return { topic, avgDuration, sessionCount: topicSessions.length };
          });

          const weakTopics = topicPerformance
            .filter(tp => tp.sessionCount > 0 && tp.avgDuration < 20)
            .sort((a, b) => a.avgDuration - b.avgDuration);

          if (weakTopics.length > 0) {
            newRecommendations.push({
              id: 'weak_topic_focus',
              type: 'study_plan',
              title: 'Foco no Assunto Fraco',
              description: `"${weakTopics[0].topic.name}" precisa de mais atenção. Sessões curtas indicam dificuldade.`,
              action: 'Estudar agora',
              priority: 'high',
              data: { topic: weakTopics[0].topic }
            });
          }
        }

        // Recomendação social baseada no progresso
        if (sessions && sessions.length > 14) {
          const weeklyAvg = sessions.slice(0, 14).reduce((sum, s) => sum + s.duration_minutes, 0) / 2;

          if (weeklyAvg > 300) { // Mais de 5h/dia
            newRecommendations.push({
              id: 'social_learning',
              type: 'social_learning',
              title: 'Compartilhar Conhecimento',
              description: 'Seu progresso é impressionante! Que tal ajudar outros estudantes no grupo de estudos?',
              action: 'Ver comunidade',
              priority: 'low'
            });
          }
        }

        // Meta semanal baseada no histórico
        if (sessions && sessions.length > 7) {
          const weeklyTotal = sessions.slice(0, 7).reduce((sum, s) => sum + s.duration_minutes, 0);
          const suggestedGoal = Math.max(300, Math.round(weeklyTotal * 1.1)); // 10% a mais

          newRecommendations.push({
            id: 'goal_adjustment',
            type: 'goal_adjustment',
            title: 'Ajuste de Meta',
            description: `Baseado no seu histórico, uma meta semanal de ${Math.round(suggestedGoal/60)}h seria desafiadora mas realista.`,
            action: 'Ajustar meta',
            priority: 'low',
            data: { suggestedGoal }
          });
        }

        setRecommendations(newRecommendations.slice(0, 3)); // Máximo 3 recomendações
      } catch (error) {
        console.error('Erro ao gerar recomendações:', error);
      } finally {
        setLoading(false);
      }
    };

    generateRecommendations();
  }, [user]);

  const getRecommendationIcon = (type: SmartRecommendation['type']) => {
    switch (type) {
      case 'study_plan': return <Target className="w-4 h-4 text-blue-500" />;
      case 'break_reminder': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'topic_review': return <BookOpen className="w-4 h-4 text-purple-500" />;
      case 'social_learning': return <Users className="w-4 h-4 text-green-500" />;
      case 'goal_adjustment': return <TrendingUp className="w-4 h-4 text-indigo-500" />;
    }
  };

  const getPriorityBadge = (priority: SmartRecommendation['priority']) => {
    const colors = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };

    return (
      <Badge className={`text-xs ${colors[priority]}`}>
        {priority === 'high' ? 'Alta' : priority === 'medium' ? 'Média' : 'Baixa'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Recomendações Inteligentes
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
          <Lightbulb className="w-5 h-5 text-primary" />
          Recomendações Inteligentes
          <Badge variant="secondary" className="text-xs">
            {recommendations.length} sugestões
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Continue estudando para receber recomendações personalizadas!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-lg border bg-gradient-to-r from-card to-card/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  {getRecommendationIcon(rec.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{rec.title}</h4>
                      {getPriorityBadge(rec.priority)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{rec.description}</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      {rec.action}
                    </Button>
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
