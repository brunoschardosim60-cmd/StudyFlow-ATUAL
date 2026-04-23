/**
 * SharedNotebook — página pública de visualização de caderno compartilhado
 * Modo leitura limpo: sem app chrome, editorial, focado no conteúdo.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BookOpen, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SharedPage {
  id: string;
  page_number: number;
  content: string;
}

interface SharedNotebookData {
  id: string;
  title: string;
  subject: string | null;
  cover_color: string;
}

export default function SharedNotebook() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [notebook, setNotebook] = useState<SharedNotebookData | null>(null);
  const [pages, setPages] = useState<SharedPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Link inválido."); setLoading(false); return; }
    loadSharedNotebook();
  }, [token]);

  async function loadSharedNotebook() {
    try {
      const { data: share, error: shareErr } = await supabase
        .from("notebook_shares")
        .select("notebook_id, is_public, expires_at")
        .eq("share_token", token!)
        .maybeSingle();

      if (shareErr || !share) { setError("Link não encontrado ou expirado."); return; }
      if (!share.is_public) { setError("Este caderno não está mais público."); return; }
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        setError("Este link de compartilhamento expirou."); return;
      }

      const { data: nb } = await supabase
        .from("notebooks")
        .select("id, title, subject, cover_color")
        .eq("id", share.notebook_id)
        .maybeSingle();

      if (!nb) { setError("Caderno não encontrado."); return; }
      setNotebook(nb);

      const { data: pgs } = await supabase
        .from("notebook_pages")
        .select("id, page_number, content")
        .eq("notebook_id", share.notebook_id)
        .order("page_number");

      setPages(pgs ?? []);
    } catch {
      setError("Erro ao carregar caderno.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="font-heading text-xl font-bold">Caderno indisponível</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" onClick={() => navigate("/")}>Ir para o StudyFlow</Button>
        </div>
      </div>
    );
  }

  const page = pages[currentPage];

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header — clean reading mode */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: notebook?.cover_color ?? "#3B82F6" }}
          >
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading font-bold text-lg truncate">{notebook?.title}</h1>
            {notebook?.subject && (
              <p className="text-xs text-muted-foreground">{notebook.subject}</p>
            )}
          </div>
          {pages.length > 1 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {currentPage + 1} / {pages.length}
            </span>
          )}
        </div>
      </header>

      {/* Content — editorial reading mode */}
      <article className="mx-auto max-w-3xl px-6 sm:px-8 py-10 sm:py-14">
        {page ? (
          <div
            className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-heading prose-p:leading-relaxed prose-p:text-foreground/90"
            dangerouslySetInnerHTML={{ __html: page.content || "<p class='text-muted-foreground italic'>Página vazia</p>" }}
          />
        ) : (
          <p className="text-muted-foreground text-center py-16">Nenhuma página disponível.</p>
        )}
      </article>

      {/* Page navigation — clean and minimal */}
      {pages.length > 1 && (
        <nav className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border/50">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 0}
              onClick={() => setCurrentPage(p => p - 1)}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>

            <div className="flex gap-1.5">
              {pages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentPage
                      ? "bg-primary scale-125"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Página ${idx + 1}`}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= pages.length - 1}
              onClick={() => setCurrentPage(p => p + 1)}
              className="gap-1"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </nav>
      )}

      {/* Minimal footer */}
      <footer className="py-8 text-center">
        <p className="text-xs text-muted-foreground mb-3">
          Compartilhado via <span className="font-medium text-primary">StudyFlow</span>
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/")}>
          <ExternalLink className="w-3.5 h-3.5" /> Abrir StudyFlow
        </Button>
      </footer>
    </div>
  );
}
