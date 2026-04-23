import { useEffect, useRef, useState } from "react";
import { Subject, ALL_SUBJECTS } from "@/lib/studyData";
import { Plus } from "lucide-react";

interface AddTopicFormProps {
  onAdd: (tema: string, materia: Subject, data: string, skipWeekends: boolean) => void;
  openSignal?: number;
}

export function AddTopicForm({ onAdd, openSignal = 0 }: AddTopicFormProps) {
  const [tema, setTema] = useState("");
  const [materia, setMateria] = useState<Subject>("Matemática");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [open, setOpen] = useState(false);
  const topicInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!openSignal) return;

    setOpen(true);
    window.requestAnimationFrame(() => {
      topicInputRef.current?.focus();
      topicInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [openSignal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tema.trim()) return;
    onAdd(tema.trim(), materia, data, skipWeekends);
    setTema("");
    setSkipWeekends(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass-card rounded-xl p-4 w-full flex items-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Adicionar tópico</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          ref={topicInputRef}
          type="text"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Nome do tópico..."
          autoFocus
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={materia}
          onChange={(e) => setMateria(e.target.value as Subject)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {ALL_SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
        <input
          type="checkbox"
          checked={skipWeekends}
          onChange={(e) => setSkipWeekends(e.target.checked)}
          className="h-4 w-4 rounded border border-input"
        />
        Pular sábado e domingo no cálculo das revisões
      </label>
      <div className="flex gap-2 flex-col sm:flex-row">
        <button type="submit" className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          Salvar tópico
        </button>
        <button type="button" onClick={() => setOpen(false)} className="w-full sm:w-auto px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
