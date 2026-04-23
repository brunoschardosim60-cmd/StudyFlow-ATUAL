import { BookOpen, CheckCircle2, BarChart3, Layers, AlertTriangle } from "lucide-react";

interface StatsCardsProps {
  total: number;
  totalRevisoes: number;
  percentual: number;
  materias: number;
  overdue: number;
}

export function StatsCards({ total, totalRevisoes, percentual, materias, overdue }: StatsCardsProps) {
  const cards = [
    { icon: BookOpen, label: "Tópicos", value: total, color: "text-primary" },
    { icon: CheckCircle2, label: "Revisadas", value: totalRevisoes, color: "text-secondary" },
    { icon: BarChart3, label: "Progresso", value: `${percentual}%`, color: "text-accent" },
    { icon: Layers, label: "Matérias", value: materias, color: "text-subject-chem" },
    { icon: AlertTriangle, label: "Atrasadas", value: overdue, color: overdue > 0 ? "text-destructive" : "text-secondary" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="glass-card rounded-xl p-3 sm:p-5"
        >
          <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
          <p className="text-xl sm:text-2xl font-heading font-bold">{card.value}</p>
          <p className="text-xs sm:text-sm text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
