export { getWeekDateRange } from "@/components/SharedScheduleView/types";

export interface AuditDetailStructured {
  message: string;
  changes?: { date: string; role: string; from: string | null; to: string | null }[];
  added?: { date: string; roleName: string; memberName: string }[];
  mode?: string;
  removedCount?: number;
}

export function tryParseJson(str: string | null): AuditDetailStructured | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null && "message" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

export function formatRelativeTime(
  isoStr: string,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("now");
  if (diffMin < 60) return t("minutesAgo", { n: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t("hoursAgo", { n: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return t("yesterday");
  if (diffDays < 30) return t("daysAgo", { n: diffDays });
  return new Date(isoStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function slotKey(scheduleDateId: number, roleId: number, slotIndex: number): string {
  return `${scheduleDateId}|${roleId}|${slotIndex}`;
}
