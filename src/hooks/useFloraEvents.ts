import { useEffect } from "react";
import { toast } from "sonner";
import { createTopic, StudyTopic, WeeklySlot, ALL_SUBJECTS, Subject } from "@/lib/studyData";
import { toLocalDateStr } from "@/lib/dateUtils";

const DAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  segunda: 0, terca: 1, terça: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5, sábado: 5, domingo: 6,
};

export function normalizeFloraSlots(payload: any): WeeklySlot[] {
  const raw: any[] = payload?.slots || [];
  const result: WeeklySlot[] = [];
  for (const s of raw) {
    let dia: number | undefined;
    if (typeof s.dia === "number") dia = s.dia;
    else if (typeof s.dayOfWeek === "string") dia = DAY_MAP[s.dayOfWeek.toLowerCase()];
    if (dia === undefined || dia < 0 || dia > 6) continue;

    const horario = s.horario || s.startTime || "08:00";
    const materia = s.materia || s.subject || null;
    const descricao = s.descricao || (materia ? `${materia}` : "");

    result.push({
      id: `flora-${Date.now()}-${result.length}`,
      dia,
      horario,
      materia: ALL_SUBJECTS.includes(materia as Subject) ? (materia as Subject) : null,
      descricao,
      concluido: false,
    });
  }
  return result;
}

export function mergeScheduleSlots(existing: WeeklySlot[], incoming: WeeklySlot[]): WeeklySlot[] {
  const merged = [...existing];
  for (const slot of incoming) {
    const exists = merged.some((m) => m.dia === slot.dia && m.horario === slot.horario);
    if (!exists) merged.push(slot);
    else {
      const idx = merged.findIndex((m) => m.dia === slot.dia && m.horario === slot.horario);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...slot, id: merged[idx].id };
    }
  }
  return merged.sort((a, b) => a.dia - b.dia || a.horario.localeCompare(b.horario));
}

interface UseFloraEventsParams {
  topics: StudyTopic[];
  setTopics: React.Dispatch<React.SetStateAction<StudyTopic[]>>;
  setWeekly: React.Dispatch<React.SetStateAction<WeeklySlot[]>>;
  setQuizTopic: (topic: StudyTopic | null) => void;
  setQuizInitialQuestions: (questions: any[] | undefined) => void;
  setNotesTopic: (topic: StudyTopic | null) => void;
  setTab: (tab: "revisao" | "semanal") => void;
  timer: { running: boolean; openFocusMode: () => void };
  dailyGoals: { studyMinutes: number; revisions: number; quizCount: number };
}

/** Centraliza todos os listeners de eventos disparados pela Flora. */
export function useFloraEvents({
  topics,
  setTopics,
  setWeekly,
  setQuizTopic,
  setQuizInitialQuestions,
  setNotesTopic,
  setTab,
  timer,
  dailyGoals,
}: UseFloraEventsParams) {
  useEffect(() => {
    const handleFloraQuiz = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.questions?.length) return;
      const materia = detail.materia || "Geral";
      const tema = detail.tema || "Quiz da Flora";

      let topic = topics.find(t => t.tema.toLowerCase() === tema.toLowerCase() && t.materia === materia);
      if (!topic) {
        topic = createTopic(tema, ALL_SUBJECTS.includes(materia as Subject) ? (materia as Subject) : "Simulado", toLocalDateStr(new Date()), false);
        setTopics(prev => [...prev, topic!]);
      }
      setQuizInitialQuestions(detail.questions);
      setQuizTopic(topic);
    };

    const handleFloraFlashcards = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.flashcards?.length) return;
      const materia = detail.materia || "Geral";
      const tema = detail.tema || "Flashcards da Flora";

      let topic = topics.find(t => t.tema.toLowerCase() === tema.toLowerCase() && t.materia === materia);
      if (!topic) {
        topic = createTopic(tema, ALL_SUBJECTS.includes(materia as Subject) ? (materia as Subject) : "Simulado", toLocalDateStr(new Date()), false);
      }

      const newCards = detail.flashcards.map((fc: any, i: number) => ({
        id: `flora-fc-${Date.now()}-${i}`,
        frente: fc.frente || fc.front || "",
        verso: fc.verso || fc.back || "",
      }));
      const mergedFlashcards = [...(topic.flashcards || []), ...newCards];
      const updatedTopic = { ...topic, flashcards: mergedFlashcards };

      if (detail.resumo && !topic.notas.includes(detail.resumo)) {
        updatedTopic.notas = (topic.notas ? topic.notas + "\n\n" : "") + detail.resumo;
      }

      setTopics(prev => {
        const exists = prev.some(t => t.id === updatedTopic.id);
        return exists
          ? prev.map(t => t.id === updatedTopic.id ? updatedTopic : t)
          : [...prev, updatedTopic];
      });

      setNotesTopic(updatedTopic);
      toast.success(`${newCards.length} flashcards adicionados a "${tema}".`);
    };

    const handleFloraSchedule = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const incoming = normalizeFloraSlots(detail);
      if (incoming.length === 0) return;

      setWeekly(prev => mergeScheduleSlots(prev, incoming));
      setTab("semanal");
    };

    const handleFloraScheduleRemoved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { materia, dia, horario } = detail;
      setWeekly(prev => prev.map(slot => {
        let match = true;
        if (materia && slot.materia !== materia) match = false;
        if (typeof dia === "number" && slot.dia !== dia) match = false;
        if (horario && slot.horario !== horario) match = false;
        if (!match) return slot;
        return { ...slot, materia: null, descricao: "", concluido: false };
      }));
      setTab("semanal");
    };

    const handleFloraPomodoro = () => {
      if (!timer.running) {
        timer.openFocusMode();
      }
    };

    const handleFloraMetaDia = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const updatedGoals = {
        studyMinutes: detail.studyMinutes ?? dailyGoals.studyMinutes,
        revisions: detail.revisions ?? dailyGoals.revisions,
        quizCount: detail.quizCount ?? dailyGoals.quizCount,
      };
      window.dispatchEvent(new CustomEvent("gamification-goals-updated", { detail: updatedGoals }));
    };

    window.addEventListener("flora-quiz", handleFloraQuiz as EventListener);
    window.addEventListener("flora-flashcards", handleFloraFlashcards as EventListener);
    window.addEventListener("flora-schedule-updated", handleFloraSchedule as EventListener);
    window.addEventListener("flora-schedule-removed", handleFloraScheduleRemoved as EventListener);
    window.addEventListener("flora-pomodoro", handleFloraPomodoro as EventListener);
    window.addEventListener("flora-meta-dia", handleFloraMetaDia as EventListener);

    return () => {
      window.removeEventListener("flora-quiz", handleFloraQuiz as EventListener);
      window.removeEventListener("flora-flashcards", handleFloraFlashcards as EventListener);
      window.removeEventListener("flora-schedule-updated", handleFloraSchedule as EventListener);
      window.removeEventListener("flora-schedule-removed", handleFloraScheduleRemoved as EventListener);
      window.removeEventListener("flora-pomodoro", handleFloraPomodoro as EventListener);
      window.removeEventListener("flora-meta-dia", handleFloraMetaDia as EventListener);
    };
  }, [topics, setTopics, setWeekly, setQuizTopic, setQuizInitialQuestions, setNotesTopic, setTab, timer, dailyGoals]);
}
