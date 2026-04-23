import { useState } from "react";
import { WeeklySlot, Subject, ALL_SUBJECTS, SUBJECT_COLORS } from "@/lib/studyData";
import { Check, Trash2, Plus, Clock, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const DEFAULT_HORARIOS = [
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "13:00", "14:00", "15:00", "16:00",
  "18:00", "19:00", "20:00", "21:00",
];

interface WeeklyScheduleProps {
  slots: WeeklySlot[];
  onChange: (slots: WeeklySlot[]) => void;
}

export function WeeklySchedule({ slots, onChange }: WeeklyScheduleProps) {
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newHorario, setNewHorario] = useState("");

  const horarios = [...new Set(slots.map((s) => s.horario))].sort();

  const getSlot = (horario: string, dia: number) =>
    slots.find((s) => s.horario === horario && s.dia === dia);

  const updateSlot = (id: string, updates: Partial<WeeklySlot>) => {
    onChange(slots.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const clearSlot = (id: string) => {
    onChange(slots.map((s) => (s.id === id ? { ...s, materia: null, descricao: "", concluido: false } : s)));
  };

  const toggleConcluido = (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    onChange(slots.map((s) => (s.id === id ? { ...s, concluido: !s.concluido } : s)));
  };

  const addHorario = () => {
    const time = newHorario.trim();
    if (!time || horarios.includes(time)) return;
    const newSlots: WeeklySlot[] = DIAS.map((_, dia) => ({
      id: `slot-${Date.now()}-${dia}`,
      dia,
      horario: time,
      materia: null,
      descricao: "",
      concluido: false,
    }));
    onChange([...slots, ...newSlots]);
    setNewHorario("");
    setShowAddRow(false);
  };

  const removeHorario = (horario: string) => {
    onChange(slots.filter((s) => s.horario !== horario));
  };

  // Stats
  const filledSlots = slots.filter((s) => s.materia);
  const completedSlots = filledSlots.filter((s) => s.concluido);
  const completionPct = filledSlots.length > 0 ? Math.round((completedSlots.length / filledSlots.length) * 100) : 0;

  // Subject distribution
  const subjectCounts: Partial<Record<Subject, number>> = {};
  for (const s of filledSlots) {
    if (s.materia) subjectCounts[s.materia] = (subjectCounts[s.materia] || 0) + 1;
  }
  const topSubjects = Object.entries(subjectCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  // Available horarios to add
  const availableHorarios = DEFAULT_HORARIOS.filter((h) => !horarios.includes(h));

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-heading font-semibold text-sm">Progresso da semana</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {completedSlots.length}/{filledSlots.length} atividades
          </span>
        </div>
        <Progress value={completionPct} className="h-2" />
        {topSubjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topSubjects.map(([subject, count]) => (
              <span
                key={subject}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SUBJECT_COLORS[subject as Subject]} text-primary-foreground`}
              >
                {subject}: {count}h
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Schedule table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto px-1 sm:px-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3 font-heading font-semibold text-left w-[100px]">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Horário
                  </div>
                </th>
                {DIAS.map((dia, i) => (
                  <th key={dia} className="p-3 font-heading font-semibold text-center">
                    <span className="hidden sm:inline">{dia}</span>
                    <span className="sm:hidden">{DIAS_SHORT[i]}</span>
                  </th>
                ))}
                <th className="p-2 w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {horarios.map((horario) => {
                const rowSlots = DIAS.map((_, dia) => getSlot(horario, dia)).filter(Boolean);
                const rowFilled = rowSlots.filter((s) => s?.materia);
                const rowDone = rowFilled.filter((s) => s?.concluido);

                return (
                  <tr key={horario} className="border-b border-border/50 group/row">
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{horario}</span>
                        {rowFilled.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {rowDone.length}/{rowFilled.length} ✓
                          </span>
                        )}
                      </div>
                    </td>
                    {DIAS.map((_, dia) => {
                      const slot = getSlot(horario, dia);
                      if (!slot) return <td key={dia} className="p-2" />;

                      const isEditing = editingSlot === slot.id;
                      const isHovered = hoveredSlot === slot.id;

                      return (
                        <td key={dia} className="p-1.5">
                          {isEditing ? (
                            <div className="space-y-1.5 p-1">
                              <select
                                value={slot.materia || ""}
                                onChange={(e) => updateSlot(slot.id, { materia: (e.target.value || null) as Subject | null })}
                                className="w-full text-xs px-2 py-1.5 rounded-lg bg-muted border border-border focus:ring-2 focus:ring-primary/30 outline-none"
                              >
                                <option value="">— Matéria —</option>
                                {ALL_SUBJECTS.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={slot.descricao}
                                onChange={(e) => updateSlot(slot.id, { descricao: e.target.value })}
                                placeholder="Descrição..."
                                className="w-full text-xs px-2 py-1.5 rounded-lg bg-muted border border-border focus:ring-2 focus:ring-primary/30 outline-none"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setEditingSlot(null)}
                                  className="text-xs text-primary font-semibold px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
                                >
                                  OK
                                </button>
                                <button
                                  onClick={() => { clearSlot(slot.id); setEditingSlot(null); }}
                                  className="text-xs text-muted-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
                                >
                                  Limpar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingSlot(slot.id)}
                              onMouseEnter={() => setHoveredSlot(slot.id)}
                              onMouseLeave={() => setHoveredSlot(null)}
                              onTouchStart={() => setHoveredSlot(slot.id)}
                              className={`p-2 rounded-lg cursor-pointer min-h-[52px] flex flex-col gap-1 transition-all relative group
                                ${slot.materia
                                  ? `${SUBJECT_COLORS[slot.materia]} bg-opacity-15 ${slot.concluido ? "ring-2 ring-secondary/40" : "hover:ring-2 hover:ring-primary/20"}`
                                  : "bg-muted/20 hover:bg-muted/40 border border-dashed border-border/50"
                                }`}
                            >
                              {/* Action buttons */}
                              {slot.materia && (
                                <div className={`absolute top-0.5 right-0.5 flex gap-0.5 transition-all z-10 ${
                                  isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
                                }`}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleConcluido(slot.id); }}
                                    className={`p-1 rounded-md transition-all ${slot.concluido ? "bg-secondary/20 text-secondary" : "hover:bg-muted text-muted-foreground"}`}
                                    title={slot.concluido ? "Desmarcar" : "Concluir"}
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); clearSlot(slot.id); }}
                                    className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-all"
                                    title="Limpar"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {slot.materia ? (
                                <>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                                      {slot.materia}
                                    </span>
                                    {slot.concluido && (
                                      <Check className="w-3 h-3 text-secondary flex-shrink-0" />
                                    )}
                                  </div>
                                  {slot.descricao && (
                                    <span className="text-[10px] text-primary-foreground/80 truncate leading-tight">
                                      {slot.descricao}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/50 text-center m-auto">
                                  +
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-1">
                      <button
                        onClick={() => removeHorario(horario)}
                        className="p-1 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover/row:opacity-100"
                        title="Remover horário"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add horario row */}
        <div className="border-t border-border/50 p-3">
          {showAddRow ? (
            <div className="flex items-center gap-2 flex-wrap">
              {availableHorarios.length > 0 ? (
                <select
                  value={newHorario}
                  onChange={(e) => setNewHorario(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted border border-border focus:ring-2 focus:ring-primary/30 outline-none"
                >
                  <option value="">Escolher horário</option>
                  {availableHorarios.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="time"
                  value={newHorario}
                  onChange={(e) => setNewHorario(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted border border-border"
                />
              )}
              <Button size="sm" variant="default" onClick={addHorario} disabled={!newHorario} className="text-xs h-7 gap-1">
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddRow(false); setNewHorario(""); }} className="text-xs h-7">
                Cancelar
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRow(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar horário
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
