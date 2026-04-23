import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, BookOpen, Trash2, Loader2, ArrowLeft, Star, StarOff, FolderOpen, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { ALL_SUBJECTS } from "@/lib/studyData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Notebook {
  id: string;
  title: string;
  subject: string | null;
  cover_color: string;
  created_at: string;
  updated_at: string;
  folder: string | null;
  is_favorite: boolean;
  topic_id: string | null;
}

const COVER_COLORS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#F97316",
  "#10B981", "#EF4444", "#06B6D4", "#6366F1",
];

const FIXED_FOLDERS = ["Provas", "Resumos"];

export default function Notebooks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [subjectFolders, setSubjectFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState<string>("");
  const [newColor, setNewColor] = useState(COVER_COLORS[0]);
  const [newFolder, setNewFolder] = useState<string>("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contentMatches, setContentMatches] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotebooks();
      loadSubjectFolders();
    }
  }, [user]);

  // Search inside notebook page content when query has 3+ chars
  useEffect(() => {
    if (!user || searchQuery.length < 3) {
      setContentMatches({});
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from("notebook_pages")
          .select("notebook_id, content")
          .eq("user_id", user.id)
          .ilike("content", `%${searchQuery}%`);
        const matches: Record<string, string> = {};
        for (const p of data || []) {
          if (!matches[p.notebook_id]) {
            const idx = p.content.toLowerCase().indexOf(searchQuery.toLowerCase());
            const start = Math.max(0, idx - 30);
            const end = Math.min(p.content.length, idx + searchQuery.length + 30);
            matches[p.notebook_id] = "..." + p.content.slice(start, end).replace(/\n/g, " ") + "...";
          }
        }
        setContentMatches(matches);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  const loadSubjectFolders = async () => {
    const { data } = await supabase
      .from("study_state")
      .select("topics")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data?.topics && Array.isArray(data.topics)) {
      const subjects = [...new Set((data.topics as any[]).map((t: any) => t.materia).filter(Boolean))] as string[];
      setSubjectFolders(subjects);
    }
  };

  const loadNotebooks = async () => {
    const { data, error } = await supabase
      .from("notebooks")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar cadernos");
      console.error(error);
    } else {
      setNotebooks((data || []) as Notebook[]);
    }
    setLoading(false);
  };

  const createNotebook = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("notebooks")
      .insert({
        title: newTitle.trim(),
        subject: newSubject || null,
        cover_color: newColor,
        user_id: user!.id,
        folder: newFolder || null,
        is_favorite: false,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao criar caderno");
      console.error(error);
    } else if (data) {
      setNotebooks((prev) => [data as Notebook, ...prev]);
      setShowNew(false);
      setNewTitle("");
      setNewSubject("");
      setNewFolder("");
      toast.success("Caderno criado!");
      navigate(`/notebooks/${data.id}`);
    }
    setCreating(false);
  };

  const deleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Apagar este caderno e todas as páginas?")) return;
    const { error } = await supabase.from("notebooks").delete().eq("id", id);
    if (error) toast.error("Erro ao apagar");
    else setNotebooks((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleFavorite = async (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("notebooks").update({ is_favorite: !current }).eq("id", id);
    if (!error) {
      setNotebooks((prev) => prev.map((n) => n.id === id ? { ...n, is_favorite: !current } : n));
    }
  };

  // Build dynamic folders: subjects from topics + any custom folders from notebooks
  // Order: alphabetical subject/custom folders first, then fixed folders (Provas, Resumos) last
  const customFolders = [...new Set(notebooks.map((n) => n.folder).filter(Boolean))] as string[];
  const dynamicFolders = [...new Set([...subjectFolders, ...customFolders])]
    .filter((f) => !FIXED_FOLDERS.includes(f))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const allFolders = [...dynamicFolders, ...FIXED_FOLDERS];

  // Filter notebooks (title, subject, folder + page content)
  const filtered = notebooks.filter((nb) => {
    if (showFavorites && !nb.is_favorite) return false;
    if (activeFolder && nb.folder !== activeFolder) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        nb.title.toLowerCase().includes(q) ||
        (nb.subject || "").toLowerCase().includes(q) ||
        (nb.folder || "").toLowerCase().includes(q) ||
        contentMatches[nb.id]
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <div className="container max-w-5xl mx-auto px-2 sm:px-4 py-5 sm:py-8 space-y-5">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-40 rounded-2xl bg-muted/40 animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-page-slide-in">
      <div className="container max-w-5xl mx-auto px-2 sm:px-4 py-5 sm:py-8 space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-lg h-11 w-11 sm:h-10 sm:w-10"
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <h1 className="font-heading text-xl sm:text-2xl font-bold truncate">Meus Cadernos</h1>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-1.5 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Novo Caderno
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 flex-1 min-w-[180px] max-w-sm">
            {searching ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /> : <Search className="w-4 h-4 text-muted-foreground" />}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cadernos e conteúdo..."
              className="bg-transparent text-sm outline-none w-full"
            />
          </div>
          <button
            onClick={() => { setActiveFolder(null); setShowFavorites(false); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              !activeFolder && !showFavorites ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => { setShowFavorites(!showFavorites); setActiveFolder(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              showFavorites ? "bg-amber-500/15 border-amber-500/40 text-amber-600" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Favoritos
          </button>
          {allFolders.map((f) => (
            <button
              key={f}
              onClick={() => { setActiveFolder(f); setShowFavorites(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                activeFolder === f ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" /> {f}
            </button>
          ))}
        </div>

        {showNew && (
          <div className="glass-card rounded-xl p-4 space-y-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nome do caderno..."
              onKeyDown={(e) => e.key === "Enter" && createNotebook()}
              autoFocus
            />
            <div className="flex gap-3 flex-wrap items-end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Matéria (opcional)</p>
                <Select value={newSubject} onValueChange={(v) => {
                  const val = v === "__none__" ? "" : v;
                  setNewSubject(val);
                  if (val) setNewFolder(val);
                }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Sem matéria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem matéria</SelectItem>
                    {ALL_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pasta</p>
                <Select value={newFolder} onValueChange={(v) => setNewFolder(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Sem pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem pasta</SelectItem>
                    {allFolders.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cor da capa</p>
                <div className="flex gap-1.5 flex-wrap max-w-[220px] sm:max-w-none">
                  {COVER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-11 h-11 sm:w-7 sm:h-7 rounded-lg transition-all ${newColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 ml-auto w-full sm:w-auto">
                <Button variant="ghost" size="sm" className="flex-1 sm:flex-none" onClick={() => setShowNew(false)}>Cancelar</Button>
                <Button size="sm" className="flex-1 sm:flex-none" onClick={createNotebook} disabled={creating}>
                  {creating && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                  Criar
                </Button>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 && !showNew ? (
          <div className="text-center py-16 space-y-3">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">
              {notebooks.length === 0 ? "Nenhum caderno ainda." : "Nenhum caderno encontrado."}
            </p>
            {notebooks.length === 0 && (
              <Button onClick={() => setShowNew(true)} variant="outline" className="gap-1.5">
                <Plus className="w-4 h-4" /> Criar primeiro caderno
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((nb) => (
              <div
                key={nb.id}
                onClick={() => navigate(`/notebooks/${nb.id}`)}
                className="group cursor-pointer"
              >
                <div
                  className="aspect-[3/4] rounded-xl flex flex-col justify-end p-4 relative overflow-hidden transition-transform hover:scale-[1.02] shadow-md"
                  style={{ backgroundColor: nb.cover_color }}
                >
                  {/* Decorative pen icon */}
                  <Pencil className="absolute top-3 left-3 w-5 h-5 text-white/30" />

                  {/* Favorite toggle */}
                  <button
                    onClick={(e) => toggleFavorite(nb.id, nb.is_favorite, e)}
                    className="absolute top-2 right-10 sm:right-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-black/20 rounded-lg min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 text-white hover:bg-black/40 transition-all flex items-center justify-center"
                  >
                    {nb.is_favorite ? <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> : <StarOff className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => deleteNotebook(nb.id, e)}
                    className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-black/30 rounded-lg min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 text-white hover:bg-black/50 transition-all flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <p className="font-heading font-bold text-white text-sm truncate">{nb.title}</p>
                    {nb.subject && (
                      <p className="text-white/70 text-xs truncate">{nb.subject}</p>
                    )}
                    {nb.folder && (
                      <p className="text-white/50 text-[10px] truncate mt-0.5">📁 {nb.folder}</p>
                    )}
                    {nb.topic_id && (
                      <p className="text-white/70 text-[10px] truncate mt-0.5">🔗 Tema vinculado</p>
                    )}
                    {contentMatches[nb.id] && (
                      <p className="text-white/60 text-[10px] mt-1 line-clamp-2 italic">🔍 {contentMatches[nb.id]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
