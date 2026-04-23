import { describe, expect, it } from "vitest";
import {
  getDefaultGamificationState,
  registerQuiz,
  registerRevision,
  registerStudySession,
} from "@/lib/gamification";

describe("gamification", () => {
  it("acumula XP por ação com regras base", () => {
    const base = getDefaultGamificationState();

    const afterSession = registerStudySession(base, 25 * 60 * 1000);
    const afterRevision = registerRevision(afterSession);
    const afterQuiz = registerQuiz(afterRevision);

    expect(afterSession.xp).toBe(25); // 25 min = 25 XP
    expect(afterRevision.xp).toBe(30); // +5 revisão
    expect(afterQuiz.xp).toBe(45); // +15 quiz
  });

  it("concede bônus ao concluir metas diárias", () => {
    const base = {
      ...getDefaultGamificationState(),
      todayStudyMinutes: 29,
      todayRevisions: 4,
      todayQuizCount: 0,
    };

    const afterSession = registerStudySession(base, 60 * 1000);
    const afterRevision = registerRevision(afterSession);
    const afterQuiz = registerQuiz(afterRevision);

    // 1 XP (1 min de sessão) + 5 (revisão) + 15 (quiz) + 20 de bônus ao fechar metas
    expect(afterQuiz.xp - base.xp).toBe(41);
  });
});
