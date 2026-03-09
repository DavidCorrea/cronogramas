import type { ScheduleDateInfo } from "./types";

export function getDateDisplayLabel(
  sd: Pick<ScheduleDateInfo, "recurringEventLabel" | "label" | "type">,
  t: (key: string) => string,
): string {
  const label = sd.recurringEventLabel ?? sd.label ?? null;
  if (label) return label;
  return sd.type === "for_everyone" ? t("defaultForEveryoneLabel") : t("defaultEventLabel");
}

export function getDateDisplayTimeRange(
  sd: Pick<ScheduleDateInfo, "date" | "startTimeUtc" | "endTimeUtc" | "recurringEventStartTimeUtc" | "recurringEventEndTimeUtc">,
): string | null {
  const startUtc = sd.startTimeUtc ?? sd.recurringEventStartTimeUtc;
  const endUtc = sd.endTimeUtc ?? sd.recurringEventEndTimeUtc;
  if (!startUtc || !endUtc) return null;
  const parseHHMM = (s: string) => {
    const parts = s.split(":").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0];
  };
  const [y, mo, day] = sd.date.split("-").map(Number);
  const [sh, sm] = parseHHMM(startUtc);
  const [eh, em] = parseHHMM(endUtc);
  const startDate = new Date(Date.UTC(y, mo - 1, day, sh, sm, 0));
  const endDate = new Date(Date.UTC(y, mo - 1, day, eh, em, 0));
  const start = startDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const end = endDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${start} – ${end}`;
}
