import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StudyTopic } from "@/lib/studyData";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

interface NotebookRow {
  id: string;
  title: string;
  cover_color: string;
  subject: string | null;
  topic_id: string | null;
}

interface LinkNotebookDialogProps {
  topic: StudyTopic | null;
  open: boolean;
  onClose: () => void;
}

export function LinkNotebookDialog({ topic, open, onClose }: LinkNotebookDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("notebooks")
      .select("id, title, cover_color, subject, topic_id")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setNotebooks((data || []) as NotebookRow[]);
        setLoading(false);
      });
  }, [open, user]);

  if (!topic) return null;

  const linked = notebooks.find((n) => n.topic_id === topic.id);
  const others = notebooks.filter((n) => n.topic_id !== topic.id);

  const linkExisting = async (notebookId: string) => {
    setLinkingId(notebookId);
    const { error } = await supabase
      .from("notebooks")
      .update({ topic_id: topic.id })
      .eq("id", notebookId);
    if (error) {
      toast.error("Erro ao vincular");
    } else {
      toast.success("Caderno vinculado!");
      navigate(`/notebooks/${notebookId}`);
      onClose();
    }
    setLinkingId(null);
  };

  const createLinked = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("notebooks")
      .insert({
        title: topic.tema,
        subject: topic.materia,
        cover_color: "#3B82F6",
        user_id: user.id,
        topic_id: topic.id,
      })
      .select()
      .single();
    if (error || !data) {
      toast.error("Erro ao criar caderno");
    } else {
      toast.success("Caderno criado e vinculado!");
      navigate(`/notebooks/${data.id}`);
      onClose();
    }
    setCreating(false);
  };

  const unlink = async (notebookId: string) => {
    const { error } = await supabase
      .from("notebooks")
      .update({ topic_id: null })
      .eq("id", notebookId);
    if (error) {
      toast.error("Erro ao desvincular");
    } else {
      toast.success("Desvinculado");
      setNotebooks((prev) => prev.map((n) => n.id === notebookId ? { ...n, topic_id: null } : n));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Vincular caderno
          </DialogTitle>
          <DialogDescription>
            Associe este tema a um caderno para acessar suas anotações rapidamente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {linked && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vinculado</p>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="w-8 h-10 rounded shrink-0" style={{ backgroundColor: linked.cover_color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{linked.title}</p>
                    {linked.subject && <p className="text-xs text-muted-foreground truncate">{linked.subject}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigate(`/notebooks/${linked.id}`); onClose(); }}>
                    Abrir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => unlink(linked.id)}>
                    Desvincular
                  </Button>
                </div>
              </div>
            )}

            <Button onClick={createLinked} disabled={creating} className="w-full gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar novo caderno para "{topic.tema}"
            </Button>

            {others.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ou vincular existente
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {others.map((nb) => (
                    <button
                      key={nb.id}
                      onClick={() => linkExisting(nb.id)}
                      disabled={linkingId === nb.id}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-7 h-9 rounded shrink-0" style={{ backgroundColor: nb.cover_color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{nb.title}</p>
                        {nb.subject && <p className="text-xs text-muted-foreground truncate">{nb.subject}</p>}
                      </div>
                      {linkingId === nb.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
