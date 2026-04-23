import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { StudyStateSnapshot, Subject } from "@/lib/studyData";
import type { GamificationState } from "@/lib/gamification";

type Profile = Tables<"profiles">;
type SnapshotRow = Tables<"admin_user_snapshots">;

export interface AdminUserCard {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  updatedAt: string;
  notebooksCount: number;
  topicsCount: number;
  totalHours: number;
  subjects: string[];
}

export interface AdminUserWorkspace {
  profile: Profile;
  state: StudyStateSnapshot;
  gamification: GamificationState;
  notebooksCount: number;
}

async function callVault<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-vault", {
    body: { action, payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data as T;
}

export async function listAdminUsers(): Promise<AdminUserCard[]> {
  return callVault<AdminUserCard[]>("list_users");
}

export async function loadAdminUserWorkspace(userId: string): Promise<AdminUserWorkspace> {
  return callVault<AdminUserWorkspace>("load_workspace", { userId });
}

export async function listAdminSnapshots(userId: string): Promise<SnapshotRow[]> {
  return callVault<SnapshotRow[]>("list_snapshots", { userId });
}

export async function createAdminSnapshot(userId: string, _adminId: string, reason: string): Promise<void> {
  await callVault("create_snapshot", { userId, reason });
}

export async function updateAdminUserProfile(userId: string, _adminId: string, displayName: string): Promise<void> {
  await callVault("update_profile", { userId, displayName });
}

export async function addAdminStudyHours(
  userId: string,
  _adminId: string,
  hours: number,
  subject: Subject | null,
  note: string,
  targetDate?: string,
): Promise<void> {
  await callVault("add_hours", { userId, hours, subject, note, targetDate });
}

export async function addAdminTopic(
  userId: string,
  _adminId: string,
  tema: string,
  materia: Subject,
  notas: string,
): Promise<void> {
  await callVault("add_topic", { userId, tema, materia, notas });
}

export async function restoreAdminSnapshot(snapshotId: string, _adminId: string): Promise<void> {
  await callVault("restore_snapshot", { snapshotId });
}

export async function deleteAdminTopic(userId: string, _adminId: string, topicId: string): Promise<void> {
  await callVault("delete_topic", { userId, topicId });
}

export async function deleteAdminSession(userId: string, _adminId: string, sessionId: string): Promise<void> {
  await callVault("delete_session", { userId, sessionId });
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await callVault("delete_user", { userId });
}

const ALL_SUBJECTS_FALLBACK = [
  "Matematica", "Portugues", "Fisica", "Quimica", "Biologia",
  "Historia", "Geografia", "Filosofia", "Sociologia", "Ingles", "Redacao",
] as const;

export function getAdminSubjects(): readonly string[] {
  return ALL_SUBJECTS_FALLBACK;
}
