import { describe, expect, it } from "vitest";
import { createDefaultWeeklySlots } from "@/lib/studyData";
import { mergeStudyStates } from "@/lib/studyStateStore";

describe("studyStateStore", () => {
  it("faz merge básico de sessões e prefere tópico mais rico", () => {
    const local = {
      topics: [
        {
          id: "t1",
          tema: "Trigonometria",
          materia: "Matemática" as const,
          studyDate: "2026-04-04",
          skipWeekendsRevisions: false,
          revisions: [{ scheduledDate: "2026-04-05", completed: true, completedAt: "2026-04-04T10:00:00.000Z", difficulty: "medium" as const }],
          rating: 4,
          notas: "nota local detalhada",
          flashcards: [{ id: "f1", frente: "sen", verso: "cateto oposto/hipotenusa" }],
          quizAttempts: 1,
          quizLastScore: 0.8,
          quizErrors: ["erro 1"],
        },
      ],
      weekly: createDefaultWeeklySlots(),
      sessions: [{ id: "s1", start: "2026-04-04T10:00:00.000Z", end: "2026-04-04T10:30:00.000Z", durationMs: 1800000, topicId: "t1", subject: "Matemática" as const }],
    };

    const remote = {
      topics: [
        {
          id: "t1",
          tema: "Trigonometria",
          materia: "Matemática" as const,
          studyDate: "2026-04-04",
          skipWeekendsRevisions: false,
          revisions: [{ scheduledDate: "2026-04-05", completed: false, completedAt: null, difficulty: "medium" as const }],
          rating: 1,
          notas: "",
          flashcards: [],
          quizAttempts: 0,
          quizLastScore: null,
          quizErrors: [],
        },
      ],
      weekly: createDefaultWeeklySlots(),
      sessions: [{ id: "s2", start: "2026-04-04T11:00:00.000Z", end: "2026-04-04T11:15:00.000Z", durationMs: 900000, topicId: "t1", subject: "Matemática" as const }],
    };

    const merged = mergeStudyStates(local, remote);

    expect(merged.topics).toHaveLength(1);
    expect(merged.topics[0].notas).toBe("nota local detalhada");
    expect(merged.sessions).toHaveLength(2);
  });
});
