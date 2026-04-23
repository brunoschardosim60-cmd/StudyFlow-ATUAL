import { Button } from "@/components/ui/button";
import type { AIActivityItem } from "@/lib/aiActivityStore";
import type { NotebookPageAction } from "@/lib/notebookPageActions";

interface NotebookWorkspacePanelProps {
  linkedTopicTitle?: string;
  summary: string;
  actions: NotebookPageAction[];
  activities: AIActivityItem[];
}

export function NotebookWorkspacePanel({
  linkedTopicTitle,
  summary,
  actions,
  activities,
}: NotebookWorkspacePanelProps) {
  const primaryActions = actions.filter((action) => action.group !== "secondary");

  return (
    <>
      {summary ? (
        <div className="order-7 w-full rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Resumo automatico da pagina</p>
          <p className="max-h-16 overflow-y-auto text-sm text-foreground/90">{summary}</p>
        </div>
      ) : null}

      <div className="order-7 w-full rounded-lg border border-border/70 bg-card/70 p-3 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Workspace de IA</p>
            <p className="text-sm font-medium">
              {linkedTopicTitle ? `Conectado a ${linkedTopicTitle}` : "Esta página ainda não virou um tópico de estudo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {linkedTopicTitle
                ? "Use resumo, quiz e flashcards para fortalecer esse mesmo tema."
                : "Crie um tópico a partir desta página para aproveitar melhor resumo, quiz e flashcards."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-border/60 bg-background/50 p-3">
            <p className="text-sm font-medium">Acoes rapidas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Comece pelo resumo e depois use esse contexto para gerar flashcards, quiz e atualizar o topico.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {primaryActions.map((action) => (
                <Button key={action.id} size="sm" variant="outline" onClick={action.onSelect} disabled={action.disabled}>
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/50 p-3">
            <p className="text-sm font-medium">Historico da pagina</p>
            <div className="mt-3 space-y-2">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="rounded-md border border-border/50 bg-card/80 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{activity.detail}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  As ultimas acoes feitas com IA nesta pagina vao aparecer aqui conforme voce usar resumo, quiz, flashcards e sincronizacao.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
