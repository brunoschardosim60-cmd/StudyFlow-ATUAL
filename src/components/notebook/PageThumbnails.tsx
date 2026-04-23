/**
 * PageThumbnails — painel lateral de miniaturas de página (Samsung Notes style)
 * Mostra miniaturas clicáveis de todas as páginas + botão de adicionar/deletar
 */
import { Plus, Trash2, GripVertical } from "lucide-react";

interface Page {
  id: string;
  page_number: number;
  content: string; // HTML
}

interface PageThumbnailsProps {
  pages: Page[];
  currentPage: number;
  onSelectPage: (idx: number) => void;
  onAddPage: () => void;
  onDeletePage: (idx: number) => void;
}

// Extrai texto puro do HTML para preview
function htmlToText(html: string, max = 80): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || "").trim().slice(0, max) || "Página vazia";
}

export function PageThumbnails({
  pages, currentPage, onSelectPage, onAddPage, onDeletePage,
}: PageThumbnailsProps) {
  return (
    <div className="flex flex-col h-full w-[88px] sm:w-[100px] border-r border-border/60 bg-background/80 overflow-y-auto">
      <div className="p-1.5 space-y-1.5">
        {pages.map((page, idx) => (
          <div key={page.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelectPage(idx)}
              className={`w-full aspect-[3/4] rounded-lg border-2 transition-all overflow-hidden flex flex-col text-left ${
                idx === currentPage
                  ? "border-primary shadow-md shadow-primary/20"
                  : "border-border/40 hover:border-primary/40"
              }`}
            >
              {/* Mini preview do conteúdo */}
              <div className="flex-1 bg-white dark:bg-zinc-900 p-1 overflow-hidden">
                <p className="text-[5px] leading-tight text-zinc-700 dark:text-zinc-300 break-words line-clamp-6">
                  {typeof document !== "undefined" ? htmlToText(page.content, 120) : "..."}
                </p>
              </div>
              {/* Número da página */}
              <div className={`px-1 py-0.5 text-[9px] font-medium text-center border-t ${
                idx === currentPage
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border/40"
              }`}>
                {idx + 1}
              </div>
            </button>

            {/* Deletar página (hover) */}
            {pages.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeletePage(idx); }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Deletar página"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}

        {/* Adicionar página */}
        <button
          type="button"
          onClick={onAddPage}
          className="w-full aspect-[3/4] rounded-lg border-2 border-dashed border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center text-muted-foreground hover:text-primary"
          title="Nova página"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
