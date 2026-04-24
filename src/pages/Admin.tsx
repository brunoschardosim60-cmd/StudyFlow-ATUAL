import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCcw, Shield, Save, RotateCcw, PlusCircle, Clock3, BookOpen, Trash2, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  addAdminStudyHours,
  addAdminTopic,
  createAdminSnapshot,
  deleteAdminSession,
  deleteAdminTopic,
  deleteAdminUser,
  getAdminSubjects,
  listAdminSnapshots,
  listAdminUsers,
  loadAdminUserWorkspace,
  restoreAdminSnapshot,
  updateAdminUserProfile,
  type AdminUserCard,
  type AdminUserWorkspace,
} from "@/lib/adminVault";
import { ADMIN_EMAIL } from "@/lib/adminAccess";
import { reportError, toErrorMessage } from "@/lib/errorHandling";
import { AdminAITierPanel } from "@/components/admin/AdminAITierPanel";

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserCard[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<AdminUserWorkspace | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: string; reason: string; created_at: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [snapshotReason, setSnapshotReason] = useState("");
  const [hoursToAdd, setHoursToAdd] = useState("1");
  const [hoursNote, setHoursNote] = useState("");
  const [hoursSubject, setHoursSubject] = useState<string>("__none__");
  const [hoursDate, setHoursDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicNotes, setTopicNotes] = useState("");
  const [topicSubject, setTopicSubject] = useState<string>(getAdminSubjects()[0]);
  const [showSessions, setShowSessions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedUserCard = useMemo(
    () => users.find((item) => item.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  const refreshUsers = async () => {
    setLoadingUsers(true);
    try {
      const nextUsers = await listAdminUsers();
      setUsers(nextUsers);
      setSelectedUserId((prev) => prev ?? nextUsers[0]?.id ?? null);
    } catch (error) {
      reportError("Erro ao carregar usuarios do admin:", error, { devOnly: true });
      toast.error("Não foi possível carregar os usuários do painel admin.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const refreshWorkspace = async (userId: string) => {
    setLoadingWorkspace(true);
    try {
      const [nextWorkspace, nextSnapshots] = await Promise.all([
        loadAdminUserWorkspace(userId),
        listAdminSnapshots(userId),
      ]);
      setWorkspace(nextWorkspace);
      setDisplayName(nextWorkspace.profile.display_name);
      setSnapshots(nextSnapshots);
    } catch (error) {
      reportError("Erro ao abrir workspace do admin:", error, { devOnly: true });
      toast.error("Não foi possível abrir os dados deste usuário.");
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    void refreshUsers();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    setConfirmDelete(false);
    setShowSessions(false);
    void refreshWorkspace(selectedUserId);
  }, [selectedUserId]);

  const withSaving = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    try {
      await action();
      toast.success(successMessage);
      await refreshUsers();
      if (selectedUserId) await refreshWorkspace(selectedUserId);
    } catch (error) {
      reportError("Erro ao salvar no admin:", error, { devOnly: true });
      toast.error(toErrorMessage(error, "Não foi possível salvar no painel admin."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await deleteAdminUser(selectedUserId);
      toast.success("Conta excluída com sucesso.");
      setSelectedUserId(null);
      setWorkspace(null);
      setConfirmDelete(false);
      await refreshUsers();
    } catch (error) {
      reportError("Erro ao excluir conta:", error, { devOnly: true });
      toast.error(toErrorMessage(error, "Não foi possível excluir a conta."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-2xl font-bold">Painel Admin</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Cofre seguro para ver usuarios, criar snapshots e corrigir ou restaurar progresso.
            </p>
            <p className="text-xs text-muted-foreground">
              Conta dedicada do admin: <strong>{ADMIN_EMAIL}</strong>
            </p>
          </div>
          <Button variant="outline" onClick={() => void refreshUsers()} disabled={loadingUsers}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="space-y-3 rounded-2xl border border-border bg-card/70 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Usuarios</p>
              <span className="text-xs text-muted-foreground">{users.length} cadastrados</span>
            </div>

            {loadingUsers ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedUserId(item.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedUserId === item.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.displayName || "Sem nome"}</p>
                      {item.isAdmin ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Admin
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.id}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/60 p-2">
                        <p className="text-muted-foreground">Horas</p>
                        <p className="font-semibold">{item.totalHours}</p>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <p className="text-muted-foreground">Temas</p>
                        <p className="font-semibold">{item.topicsCount}</p>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <p className="text-muted-foreground">Cadernos</p>
                        <p className="font-semibold">{item.notebooksCount}</p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {item.subjects.length > 0 ? item.subjects.join(", ") : "Sem materias salvas ainda."}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            {!selectedUserId || !selectedUserCard ? (
              <div className="rounded-2xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
                Escolha um usuario para abrir o cofre seguro.
              </div>
            ) : loadingWorkspace || !workspace ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-card/70 p-6">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="text-xs text-muted-foreground">Usuario</p>
                    <p className="mt-1 font-semibold">{workspace.profile.display_name}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="text-xs text-muted-foreground">Horas estudadas</p>
                    <p className="mt-1 font-semibold">
                      {Math.round((workspace.state.sessions.reduce((sum, item) => sum + item.durationMs, 0) / 3_600_000) * 10) / 10}h
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="text-xs text-muted-foreground">Temas</p>
                    <p className="mt-1 font-semibold">{workspace.state.topics.length}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="text-xs text-muted-foreground">Materias</p>
                    <p className="mt-1 font-semibold">
                      {Array.from(new Set(workspace.state.topics.map((topic) => topic.materia))).length}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-4">
                    {/* Profile & Snapshot */}
                    <div className="rounded-2xl border border-border bg-card/70 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Save className="h-4 w-4 text-primary" />
                        <p className="font-medium">Perfil e correcao manual</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nome exibido</label>
                          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                          <Button
                            onClick={() => void withSaving(
                              () => updateAdminUserProfile(selectedUserId, user!.id, displayName.trim()),
                              "Nome do usuario atualizado."
                            )}
                            disabled={saving || !displayName.trim()}
                          >
                            Salvar nome
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Criar snapshot</label>
                          <Textarea
                            value={snapshotReason}
                            onChange={(event) => setSnapshotReason(event.target.value)}
                            placeholder="Ex: antes de ajustar horas que sumiram"
                          />
                          <Button
                            variant="outline"
                            onClick={() => void withSaving(
                              () => createAdminSnapshot(selectedUserId, user!.id, snapshotReason.trim() || "Snapshot manual do admin"),
                              "Snapshot salvo no cofre."
                            )}
                            disabled={saving}
                          >
                            Salvar snapshot seguro
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Add hours with date */}
                    <div className="rounded-2xl border border-border bg-card/70 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        <p className="font-medium">Adicionar horas manualmente</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Horas</label>
                          <Input value={hoursToAdd} onChange={(event) => setHoursToAdd(event.target.value)} type="number" step="0.5" min="0" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Data</label>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Input type="date" value={hoursDate} onChange={(event) => setHoursDate(event.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Materia</label>
                          <Select value={hoursSubject} onValueChange={setHoursSubject}>
                            <SelectTrigger>
                              <SelectValue placeholder="Sem materia" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sem materia</SelectItem>
                              {getAdminSubjects().map((subject) => (
                                <SelectItem key={subject} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-3">
                          <label className="text-sm font-medium">Observacao</label>
                          <Textarea
                            value={hoursNote}
                            onChange={(event) => setHoursNote(event.target.value)}
                            placeholder="Ex: recuperei horas perdidas apos reclamacao do usuario"
                          />
                        </div>
                      </div>
                      <Button
                        className="mt-3"
                        onClick={() => void withSaving(
                          () => addAdminStudyHours(
                            selectedUserId,
                            user!.id,
                            Number(hoursToAdd || 0),
                            hoursSubject === "__none__" ? null : (hoursSubject as never),
                            hoursNote.trim(),
                            hoursDate
                          ),
                          `Horas adicionadas em ${hoursDate} com backup automatico.`
                        )}
                        disabled={saving || Number(hoursToAdd || 0) <= 0}
                      >
                        Adicionar horas
                      </Button>
                    </div>

                    {/* Add topic */}
                    <div className="rounded-2xl border border-border bg-card/70 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-primary" />
                        <p className="font-medium">Adicionar tema manualmente</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Titulo do tema</label>
                          <Input value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} placeholder="Ex: Funcoes do 2 grau" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Materia</label>
                          <Select value={topicSubject} onValueChange={setTopicSubject}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAdminSubjects().map((subject) => (
                                <SelectItem key={subject} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Notas</label>
                          <Textarea value={topicNotes} onChange={(event) => setTopicNotes(event.target.value)} />
                        </div>
                      </div>
                      <Button
                        className="mt-3"
                        onClick={() => void withSaving(
                          () => addAdminTopic(selectedUserId, user!.id, topicTitle.trim(), topicSubject as never, topicNotes.trim()),
                          "Tema adicionado com backup automatico."
                        )}
                        disabled={saving || !topicTitle.trim()}
                      >
                        Criar tema
                      </Button>
                    </div>

                    {/* Topics list with delete */}
                    <div className="rounded-2xl border border-border bg-card/70 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <p className="font-medium">Temas do usuario</p>
                      </div>
                      <div className="space-y-2">
                        {workspace.state.topics.slice(0, 20).map((topic) => (
                          <div key={topic.id} className="rounded-xl border border-border bg-background p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{topic.tema}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {topic.materia} • Rating {topic.rating} • Flashcards {topic.flashcards.length} • Quiz {topic.quizAttempts}x
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => void withSaving(
                                  () => deleteAdminTopic(selectedUserId, user!.id, topic.id),
                                  `Tema "${topic.tema}" removido.`
                                )}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {workspace.state.topics.length === 0 && (
                          <p className="text-sm text-muted-foreground">Nenhum tema salvo.</p>
                        )}
                        {workspace.state.topics.length > 20 && (
                          <p className="text-xs text-muted-foreground">+{workspace.state.topics.length - 20} temas não exibidos</p>
                        )}
                      </div>
                    </div>

                    {/* Sessions list with delete */}
                    <div className="rounded-2xl border border-border bg-card/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-primary" />
                          <p className="font-medium">Sessões de estudo ({workspace.state.sessions.length})</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowSessions((v) => !v)}>
                          {showSessions ? "Ocultar" : "Mostrar"}
                        </Button>
                      </div>
                      {showSessions && (
                        <div className="max-h-[400px] space-y-3 overflow-y-auto">
                          {(() => {
                            const sorted = workspace.state.sessions.slice().sort((a, b) => b.start.localeCompare(a.start));
                            const grouped = new Map<string, typeof sorted>();
                            for (const s of sorted) {
                              const dayKey = new Date(s.start).toLocaleDateString("pt-BR");
                              if (!grouped.has(dayKey)) grouped.set(dayKey, []);
                              grouped.get(dayKey)!.push(s);
                            }
                            let shown = 0;
                            const entries = Array.from(grouped.entries());
                            return entries.map(([day, daySessions]) => {
                              if (shown >= 50) return null;
                              const dayTotalMs = daySessions.reduce((a, s) => a + s.durationMs, 0);
                              const dayTotalH = Math.round((dayTotalMs / 3_600_000) * 10) / 10;

                              // Group by subject within the day
                              const bySubject = new Map<string, { totalMs: number; sessions: typeof daySessions }>();
                              for (const s of daySessions) {
                                const key = s.subject || "__none__";
                                if (!bySubject.has(key)) bySubject.set(key, { totalMs: 0, sessions: [] });
                                const entry = bySubject.get(key)!;
                                entry.totalMs += s.durationMs;
                                entry.sessions.push(s);
                              }

                              const result = (
                                <div key={day} className="rounded-xl border border-border bg-background p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">{day}</p>
                                    <span className="text-xs font-medium text-muted-foreground">{dayTotalH}h total</span>
                                  </div>
                                  {Array.from(bySubject.entries()).map(([subjectKey, { totalMs, sessions: subSessions }]) => {
                                    const subH = Math.round((totalMs / 3_600_000) * 10) / 10;
                                    const label = subjectKey === "__none__" ? "Sem matéria" : subjectKey;
                                    return (
                                      <div key={subjectKey} className="pl-2 border-l-2 border-border/60 space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-muted-foreground">{label}</span>
                                          <span className="text-xs text-muted-foreground">{subH}h</span>
                                        </div>
                                        {subSessions.map((session) => {
                                          shown++;
                                          const sessionH = Math.round((session.durationMs / 3_600_000) * 10) / 10;
                                          return (
                                            <div key={session.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2 py-1.5">
                                              <span className="text-xs">{sessionH}h</span>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                                onClick={() => void withSaving(
                                                  () => deleteAdminSession(selectedUserId, user!.id, session.id),
                                                  "Sessão removida."
                                                )}
                                                disabled={saving}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                              return result;
                            });
                          })()}
                          {workspace.state.sessions.length === 0 && (
                            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
                          )}
                          {workspace.state.sessions.length > 50 && (
                            <p className="text-xs text-muted-foreground">Mostrando últimas 50 de {workspace.state.sessions.length}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete account */}
                    {!selectedUserCard?.isAdmin && (
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <p className="font-medium text-destructive">Zona de perigo</p>
                        </div>
                        {!confirmDelete ? (
                          <Button
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDelete(true)}
                            disabled={saving}
                          >
                            Excluir conta deste usuário
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-destructive">
                              Tem certeza? Isso vai excluir <strong>todos</strong> os dados e a conta de login. Ação irreversível.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => void handleDeleteUser()}
                                disabled={saving}
                              >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Sim, excluir permanentemente
                              </Button>
                              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={saving}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Snapshots sidebar */}
                  <aside className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-primary" />
                      <p className="font-medium">Cofre seguro</p>
                    </div>
                    <div className="space-y-3">
                      {snapshots.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Ainda nao ha snapshots para este usuario. Salve um antes de editar.
                        </p>
                      ) : (
                        snapshots.map((snapshot) => (
                          <div key={snapshot.id} className="rounded-xl border border-border bg-background p-3">
                            <p className="text-sm font-medium">{snapshot.reason || "Snapshot manual"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(snapshot.created_at).toLocaleString("pt-BR")}
                            </p>
                            <Button
                              className="mt-3 w-full"
                              variant="outline"
                              onClick={() => void withSaving(
                                () => restoreAdminSnapshot(snapshot.id, user!.id),
                                "Snapshot restaurado com sucesso."
                              )}
                              disabled={saving}
                            >
                              Restaurar este estado
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </aside>
                </div>
              </>
            )}
          </section>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">IA & Tiers (Free / Pro / Pro+)</h2>
          </div>
          <AdminAITierPanel users={users.map((u) => ({ id: u.id, display_name: u.displayName }))} />
        </section>
      </div>
    </div>
  );
}
