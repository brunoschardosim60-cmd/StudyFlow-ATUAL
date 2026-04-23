export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isPastDateLocal(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(parseLocalDate(dateStr));
  return target.getTime() < today.getTime();
}

export function daysDiffFromToday(dateStr: string): number {
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(parseLocalDate(dateStr));
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function toHumanRelativeDay(dateStr: string): string {
  const diff = daysDiffFromToday(dateStr);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanha";
  if (diff > 1) return `em ${diff} dias`;
  const overdue = Math.abs(diff);
  return `${overdue} dia${overdue > 1 ? "s" : ""} atrasado${overdue > 1 ? "s" : ""}`;
}

export function addDaysLocal(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

export function moveToNextBusinessDay(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return toLocalDateStr(d);
}
