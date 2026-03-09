import type { AvailabilityBlock } from "./types";

export const MIN_BLOCK_MINUTES = 30;
export const SNAP_MINUTES = 30;
export const TOTAL_MINUTES = 24 * 60;
export const STEPS_PER_HOUR = TOTAL_MINUTES / 24 / SNAP_MINUTES;
export const STEPS_PER_DAY = 24 * STEPS_PER_HOUR;
export const HEADER_HEIGHT = 40;
export const BODY_PADDING_TOP = 12;
export const BODY_PADDING_BOTTOM = 12;

export function getBodyHeightPx(gridHeight: number): number {
  return gridHeight - BODY_PADDING_TOP - BODY_PADDING_BOTTOM;
}

export function parseHHMM(s: string): number {
  const [h, m] = (s ?? "00:00").trim().split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(TOTAL_MINUTES, Math.max(0, h * 60 + m));
}

export function minutesToHHMM(min: number): string {
  const m = Math.min(TOTAL_MINUTES, Math.max(0, Math.round(min)));
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function snapToStep(min: number): number {
  const rounded = Math.round(min / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.min(TOTAL_MINUTES, Math.max(0, rounded));
}

export function normalizeDayBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  if (blocks.length === 0) return [];
  const parsed = blocks
    .map((b) => {
      const start = Math.max(0, Math.min(TOTAL_MINUTES, parseHHMM(b.startLocal)));
      const end = Math.max(0, Math.min(TOTAL_MINUTES, parseHHMM(b.endLocal)));
      return { start, end };
    })
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  if (parsed.length === 0) return [];
  const merged: { start: number; end: number }[] = [];
  for (const b of parsed) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
    } else {
      merged.push({ start: b.start, end: b.end });
    }
  }
  const total = merged.reduce((s, b) => s + (b.end - b.start), 0);
  if (total <= TOTAL_MINUTES) {
    return merged.map((b) => ({
      startLocal: minutesToHHMM(b.start),
      endLocal: minutesToHHMM(b.end),
    }));
  }
  let toTrim = total - TOTAL_MINUTES;
  for (let i = merged.length - 1; i >= 0 && toTrim > 0; i--) {
    const len = merged[i].end - merged[i].start;
    if (toTrim >= len) {
      toTrim -= len;
      merged.splice(i, 1);
    } else {
      merged[i].end -= toTrim;
      toTrim = 0;
    }
  }
  return merged.map((b) => ({
    startLocal: minutesToHHMM(b.start),
    endLocal: minutesToHHMM(b.end),
  }));
}
