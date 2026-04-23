export interface NotebookPageAction {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  group?: "primary" | "secondary";
}

interface NotebookPageActionsParams {
  generatingStudy: boolean;
  quizDifficulty: "facil" | "medio" | "dificil";
  pinned: boolean;
  hasLinkedTopic: boolean;
  hasSummary: boolean;
  onGenerateSummary: () => void;
  onGenerateFlashcards: () => void;
  onGenerateQuiz: () => void;
  onCreateTopic: () => void;
  onSyncSummary: () => void;
  onSetQuizDifficulty: (difficulty: "facil" | "medio" | "dificil") => void;
  onTogglePinned: () => void;
}

export function getNotebookPageActions(params: NotebookPageActionsParams): NotebookPageAction[] {
  const disabled = params.generatingStudy;

  return [
    {
      id: "summary",
      label: "Resumir pagina",
      onSelect: params.onGenerateSummary,
      disabled,
      group: "primary",
    },
    {
      id: "flashcards",
      label: "Gerar flashcards",
      onSelect: params.onGenerateFlashcards,
      disabled,
      group: "primary",
    },
    {
      id: "quiz",
      label: `Gerar quiz${params.quizDifficulty !== "medio" ? ` (nivel ${params.quizDifficulty})` : ""}`,
      onSelect: params.onGenerateQuiz,
      disabled,
      group: "primary",
    },
    {
      id: "create-topic",
      label: "Criar topico",
      onSelect: params.onCreateTopic,
      disabled,
      group: "primary",
    },
    {
      id: "sync-summary",
      label: "Enviar resumo para o topico",
      onSelect: params.onSyncSummary,
      disabled: disabled || !params.hasLinkedTopic || !params.hasSummary,
      group: "primary",
    },
    {
      id: "quiz-facil",
      label: "Quiz facil",
      onSelect: () => params.onSetQuizDifficulty("facil"),
      group: "secondary",
    },
    {
      id: "quiz-medio",
      label: "Quiz medio",
      onSelect: () => params.onSetQuizDifficulty("medio"),
      group: "secondary",
    },
    {
      id: "quiz-dificil",
      label: "Quiz dificil",
      onSelect: () => params.onSetQuizDifficulty("dificil"),
      group: "secondary",
    },
    {
      id: "toggle-pin",
      label: params.pinned ? "Desfixar pagina" : "Fixar pagina",
      onSelect: params.onTogglePinned,
      group: "secondary",
    },
  ];
}
