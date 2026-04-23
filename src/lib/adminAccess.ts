export const ADMIN_EMAIL = "studyflow@study.com";

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isDedicatedAdminEmail(email: string | null | undefined) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}
