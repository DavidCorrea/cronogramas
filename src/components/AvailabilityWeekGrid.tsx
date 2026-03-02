"use client";

import { useCallback, useRef, useState } from "react";

const MIN_BLOCK_MINUTES = 30;
const SNAP_MINUTES = 30; // snap to 30-min boundaries
const TOTAL_MINUTES = 24 * 60; // 1440
const STEPS_PER_HOUR = TOTAL_MINUTES / 24 / SNAP_MINUTES; // 2 for 30-min
const STEPS_PER_DAY = 24 * STEPS_PER_HOUR; // 48
const HEADER_HEIGHT = 40;
/** Padding above 00 and below 24; blocks cannot extend into these areas */
const BODY_PADDING_TOP = 12;
const BODY_PADDING_BOTTOM = 12;

/** Body height in px (used for layout and block positioning so they match). */
function getBodyHeightPx(gridHeight: number): number {
  return gridHeight - BODY_PADDING_TOP - BODY_PADDING_BOTTOM;
}

function parseHHMM(s: string): number {
  const [h, m] = (s ?? "00:00").trim().split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(TOTAL_MINUTES, Math.max(0, h * 60 + m));
}

/** Normalize blocks for one day: clamp to [0,24h], merge overlaps, trim total to ≤24h. */
function normalizeDayBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
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

function minutesToHHMM(min: number): string {
  const m = Math.min(TOTAL_MINUTES, Math.max(0, Math.round(min)));
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/** Snap minutes to nearest SNAP_MINUTES (e.g. 15), clamped to [0, TOTAL_MINUTES]. */
function snapToStep(min: number): number {
  const step = SNAP_MINUTES;
  const rounded = Math.round(min / step) * step;
  return Math.min(TOTAL_MINUTES, Math.max(0, rounded));
}

export interface WeekdayOption {
  weekdayId: number;
  dayOfWeek: string;
}

export type AvailabilityBlock = { startLocal: string; endLocal: string };

export interface AvailabilityWeekGridProps {
  days: WeekdayOption[];
  /** key = weekdayId, value = array of blocks (multiple blocks per day allowed) */
  availability: Record<number, AvailabilityBlock[]>;
  onChange: (availability: Record<number, AvailabilityBlock[]>) => void;
  gridHeight?: number;
}

export default function AvailabilityWeekGrid({
  days,
  availability,
  onChange,
  gridHeight = 540,
}: AvailabilityWeekGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const mobileStripRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [dragState, setDragState] = useState<{
    weekdayId: number;
    blockIndex: number;
    mode: "resize-top" | "resize-bottom" | "resize-left" | "resize-right" | "move";
    startMinutes: number;
    endMinutes: number;
    startY: number;
    startX?: number;
    layout: "desktop" | "mobile";
  } | null>(null);

  const handleHourClick = useCallback(
    (weekdayId: number, hourIndex: number) => {
      const hour = Math.max(0, Math.min(23, hourIndex));
      const startMinutes = hour * 60;
      const endMinutes = Math.min(TOTAL_MINUTES, (hour + 1) * 60);
      const newBlock: AvailabilityBlock = {
        startLocal: minutesToHHMM(startMinutes),
        endLocal: minutesToHHMM(endMinutes),
      };
      const blocks = availability[weekdayId] ?? [];
      const next = [...blocks, newBlock].sort(
        (a, b) => parseHHMM(a.startLocal) - parseHHMM(b.startLocal)
      );
      onChange({ ...availability, [weekdayId]: next });
    },
    [availability, onChange]
  );

  const handleColumnBodyClick = useCallback(
    (e: React.MouseEvent, weekdayId: number) => {
      if ((e.target as HTMLElement).closest("[data-availability-block]")) return;
      const cell = (e.target as HTMLElement).closest("[data-step]");
      if (!cell) return;
      const stepAttr = cell.getAttribute("data-step");
      if (stepAttr == null) return;
      const stepIndex = parseInt(stepAttr, 10);
      if (!Number.isFinite(stepIndex) || stepIndex < 0 || stepIndex >= STEPS_PER_DAY) return;
      const hourIndex = Math.floor(stepIndex / STEPS_PER_HOUR);
      handleHourClick(weekdayId, hourIndex);
    },
    [handleHourClick]
  );

  const handleRemoveBlock = useCallback(
    (e: React.MouseEvent, weekdayId: number, blockIndex: number) => {
      e.stopPropagation();
      const blocks = availability[weekdayId] ?? [];
      const next = blocks.filter((_, i) => i !== blockIndex);
      if (next.length === 0) {
        const nextAvail = { ...availability };
        delete nextAvail[weekdayId];
        onChange(nextAvail);
      } else {
        onChange({ ...availability, [weekdayId]: normalizeDayBlocks(next) });
      }
    },
    [availability, onChange]
  );

  const handleRemoveAllDay = useCallback(
    (e: React.MouseEvent, weekdayId: number) => {
      e.stopPropagation();
      const next = { ...availability };
      delete next[weekdayId];
      onChange(next);
    },
    [availability, onChange]
  );

  const handleMobileStripClick = useCallback(
    (e: React.MouseEvent, weekdayId: number) => {
      if ((e.target as HTMLElement).closest("[data-availability-block]")) return;
      const cell = (e.target as HTMLElement).closest("[data-step]");
      if (!cell) return;
      const stepAttr = cell.getAttribute("data-step");
      if (stepAttr == null) return;
      const stepIndex = parseInt(stepAttr, 10);
      if (!Number.isFinite(stepIndex) || stepIndex < 0 || stepIndex >= STEPS_PER_DAY) return;
      const hourIndex = Math.floor(stepIndex / STEPS_PER_HOUR);
      handleHourClick(weekdayId, hourIndex);
    },
    [handleHourClick]
  );

  const handlePointerDownBlockMobile = useCallback(
    (
      e: React.PointerEvent,
      weekdayId: number,
      blockIndex: number,
      edge: "left" | "right" | "center"
    ) => {
      e.stopPropagation();
      const blocks = availability[weekdayId] ?? [];
      const range = blocks[blockIndex];
      if (!range) return;
      const startMinutes = parseHHMM(range.startLocal);
      const endMinutes = parseHHMM(range.endLocal);
      const mode =
        edge === "left"
          ? "resize-left"
          : edge === "right"
            ? "resize-right"
            : "move";
      setDragState({
        weekdayId,
        blockIndex,
        mode,
        startMinutes,
        endMinutes,
        startY: 0,
        startX: e.clientX,
        layout: "mobile",
      });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [availability]
  );

  const handlePointerDownBlock = useCallback(
    (e: React.PointerEvent, weekdayId: number, blockIndex: number, edge: "top" | "bottom" | "center") => {
      e.stopPropagation();
      const blocks = availability[weekdayId] ?? [];
      const range = blocks[blockIndex];
      if (!range) return;
      const startMinutes = parseHHMM(range.startLocal);
      const endMinutes = parseHHMM(range.endLocal);
      const mode =
        edge === "top" ? "resize-top" : edge === "bottom" ? "resize-bottom" : "move";
      setDragState({
        weekdayId,
        blockIndex,
        mode,
        startMinutes,
        endMinutes,
        startY: e.clientY,
        layout: "desktop",
      });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [availability]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;
      const { weekdayId, blockIndex, mode, startMinutes, endMinutes, layout } = dragState;
      const blocks = [...(availability[weekdayId] ?? [])];

      let pointerMinutes: number;
      if (layout === "mobile") {
        const strip = mobileStripRefs.current[weekdayId];
        if (!strip) return;
        const rect = strip.getBoundingClientRect();
        const x = e.clientX - rect.left;
        pointerMinutes = Math.max(
          0,
          Math.min(TOTAL_MINUTES, (x / rect.width) * TOTAL_MINUTES)
        );
      } else {
        const bodyEl = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest?.("[data-column-body]") as HTMLDivElement | null;
        if (bodyEl) {
          const bodyRect = bodyEl.getBoundingClientRect();
          const bodyY = e.clientY - bodyRect.top;
          const bodyHeight = bodyRect.height;
          if (bodyHeight > 0) {
            pointerMinutes = Math.max(
              0,
              Math.min(TOTAL_MINUTES, (bodyY / bodyHeight) * TOTAL_MINUTES)
            );
          } else {
            const gridEl = gridRef.current;
            if (!gridEl) return;
            const rect = gridEl.getBoundingClientRect();
            const gridContentTop = rect.top + gridEl.clientTop;
            const bodyTop = gridContentTop + HEADER_HEIGHT + BODY_PADDING_TOP;
            const bodyH = getBodyHeightPx(gridHeight);
            const bodyYFallback = e.clientY - bodyTop;
            pointerMinutes = Math.max(
              0,
              Math.min(TOTAL_MINUTES, (bodyYFallback / bodyH) * TOTAL_MINUTES)
            );
          }
        } else {
          const gridEl = gridRef.current;
          if (!gridEl) return;
          const rect = gridEl.getBoundingClientRect();
          const gridContentTop = rect.top + gridEl.clientTop;
          const bodyTop = gridContentTop + HEADER_HEIGHT + BODY_PADDING_TOP;
          const bodyHeight = getBodyHeightPx(gridHeight);
          const bodyY = e.clientY - bodyTop;
          pointerMinutes = Math.max(
            0,
            Math.min(TOTAL_MINUTES, (bodyY / bodyHeight) * TOTAL_MINUTES)
          );
        }
      }

      let newStart = startMinutes;
      let newEnd = endMinutes;

      if (mode === "resize-top" || mode === "resize-left") {
        newStart = snapToStep(
          Math.min(endMinutes - MIN_BLOCK_MINUTES, Math.max(0, pointerMinutes))
        );
        newStart = Math.min(newStart, endMinutes - MIN_BLOCK_MINUTES);
      } else if (mode === "resize-bottom" || mode === "resize-right") {
        newEnd = snapToStep(
          Math.max(startMinutes + MIN_BLOCK_MINUTES, Math.min(TOTAL_MINUTES, pointerMinutes))
        );
        newEnd = Math.max(newEnd, startMinutes + MIN_BLOCK_MINUTES);
      } else {
        const duration = endMinutes - startMinutes;
        const newCenter = Math.max(
          duration / 2,
          Math.min(TOTAL_MINUTES - duration / 2, pointerMinutes)
        );
        newStart = snapToStep(newCenter - duration / 2);
        newEnd = newStart + duration;
        if (newEnd > TOTAL_MINUTES) {
          newEnd = TOTAL_MINUTES;
          newStart = TOTAL_MINUTES - duration;
        }
        if (newStart < 0) {
          newStart = 0;
          newEnd = duration;
        }
        newStart = snapToStep(newStart);
        newEnd = snapToStep(newEnd);
        if (newEnd - newStart < MIN_BLOCK_MINUTES) {
          newEnd = newStart + MIN_BLOCK_MINUTES;
        }
      }

      blocks[blockIndex] = {
        startLocal: minutesToHHMM(newStart),
        endLocal: minutesToHHMM(newEnd),
      };
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              startMinutes: newStart,
              endMinutes: newEnd,
              startY: e.clientY,
              startX: e.clientX,
            }
          : null
      );
      onChange({ ...availability, [weekdayId]: blocks });
    },
    [dragState, availability, onChange, gridHeight]
  );

  const handlePointerUp = useCallback(() => {
    if (dragState) {
      const { weekdayId } = dragState;
      const blocks = availability[weekdayId] ?? [];
      if (blocks.length > 0) {
        onChange({ ...availability, [weekdayId]: normalizeDayBlocks(blocks) });
      }
    }
    setDragState(null);
  }, [dragState, availability, onChange]);

  return (
    <div className="overflow-x-auto">
      {/* Desktop: days as columns, time vertical */}
      <div
        ref={gridRef}
        className="hidden md:flex min-w-[320px] border border-border rounded-lg overflow-hidden bg-muted/20"
        style={{ height: gridHeight + HEADER_HEIGHT }}
        onPointerMove={dragState?.layout === "desktop" ? handlePointerMove : undefined}
        onPointerUp={dragState ? handlePointerUp : undefined}
        onPointerLeave={dragState ? handlePointerUp : undefined}
      >
        <div className="flex flex-col shrink-0 w-12 border-r border-border bg-muted/30">
          <div className="h-10 shrink-0 border-b border-border flex items-center justify-center text-xs text-muted-foreground font-medium">
            Hora
          </div>
          <div
            className="shrink-0"
            style={{ height: BODY_PADDING_TOP }}
            aria-hidden
          />
          <div
            className="shrink-0 relative py-0 min-h-0"
            style={{ height: getBodyHeightPx(gridHeight) }}
          >
            {[0, 6, 12, 18, 24].map((hour) => (
              <div
                key={hour}
                className="absolute text-[10px] text-muted-foreground/70 -translate-y-1/2 z-10"
                style={{
                  top: `${(hour / 24) * 100}%`,
                  left: 4,
                }}
              >
                {hour === 24 ? "24" : `${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
            {/* Hour guides aligned with day columns */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-b border-border/50"
                  style={{ top: `${(i / 24) * 100}%`, height: 0 }}
                />
              ))}
            </div>
          </div>
          <div
            className="shrink-0"
            style={{ height: BODY_PADDING_BOTTOM }}
            aria-hidden
          />
        </div>

        {days.map((d) => {
          const blocks = availability[d.weekdayId] ?? [];
          const hasBlocks = blocks.length > 0;

          return (
            <div
              key={d.weekdayId}
              className="flex-1 min-w-[5.5rem] flex flex-col border-r border-border last:border-r-0"
            >
              <div className="h-10 shrink-0 border-b border-border flex items-center justify-center gap-1 bg-background">
                <span className="text-xs font-medium truncate max-w-full px-0.5" title={d.dayOfWeek}>
                  {d.dayOfWeek}
                </span>
                {hasBlocks && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveAllDay(e, d.weekdayId)}
                    className="rounded p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Quitar todo ${d.dayOfWeek}`}
                    title={`Quitar todo ${d.dayOfWeek}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div
                className="shrink-0"
                style={{ height: BODY_PADDING_TOP }}
                aria-hidden
              />
              <div
                className="shrink-0 relative cursor-pointer group"
                style={{ height: getBodyHeightPx(gridHeight) }}
                onClick={(e) => handleColumnBodyClick(e, d.weekdayId)}
                data-column-body
                role="button"
                tabIndex={0}
                aria-label={
                  hasBlocks
                    ? `${d.dayOfWeek} ${blocks.length} bloque(s)`
                    : `Agregar disponibilidad ${d.dayOfWeek}`
                }
              >
                {/* Hour borders: only at full hours, behind grid so they don't show inside blocks */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 0 }}
                  aria-hidden
                >
                  {Array.from({ length: 25 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-border/50"
                      style={{ top: `${(i / 24) * 100}%`, height: 0 }}
                    />
                  ))}
                </div>
                {/* Grid: one cell per step (e.g. 48 for 30-min), no cell borders; blocks sit in same grid */}
                <div
                  className="grid grid-cols-1 gap-0 absolute inset-0"
                  style={{ gridTemplateRows: `repeat(${STEPS_PER_DAY}, 1fr)`, zIndex: 10 }}
                  aria-hidden
                >
                  {Array.from({ length: STEPS_PER_DAY }, (_, step) => (
                    <div
                      key={`cell-${step}`}
                      data-step={step}
                      data-weekday-id={d.weekdayId}
                      className="min-h-0 w-full col-start-1"
                      style={{ gridRow: `${step + 1} / ${step + 2}` }}
                    />
                  ))}
                  {blocks.map((range, blockIndex) => {
                    const startMinutes = parseHHMM(range.startLocal);
                    const endMinutes = parseHHMM(range.endLocal);
                    const startRow = Math.floor(startMinutes / SNAP_MINUTES) + 1;
                    const endRow = Math.min(STEPS_PER_DAY, Math.ceil(endMinutes / SNAP_MINUTES)) + 1;
                    const timeLabel = `${range.startLocal}–${range.endLocal}`;
                    if (startRow >= endRow) return null;
                    return (
                      <div
                        key={`${blockIndex}-${range.startLocal}-${range.endLocal}`}
                        data-availability-block
                        className="group/block col-start-1 mx-0.5 rounded bg-primary/80 transition-colors flex flex-col cursor-grab active:cursor-grabbing z-10 relative min-h-0"
                        style={{ gridRow: `${startRow} / ${endRow}` }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(ev) => handlePointerDownBlock(ev, d.weekdayId, blockIndex, "center")}
                        title={timeLabel}
                      >
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-primary-foreground truncate px-0.5 pointer-events-none z-20"
                          title={timeLabel}
                        >
                          {timeLabel}
                        </span>
                        <div
                          className="h-3 shrink-0 cursor-n-resize flex-shrink-0 flex items-center justify-end pr-0.5 gap-0.5 z-30 relative"
                          aria-hidden
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            handlePointerDownBlock(ev, d.weekdayId, blockIndex, "top");
                          }}
                        >
                          <button
                            type="button"
                            onClick={(ev) => handleRemoveBlock(ev, d.weekdayId, blockIndex)}
                            className="rounded p-1 min-w-[28px] min-h-[28px] flex items-center justify-center text-primary-foreground/90 touch-manipulation"
                            aria-label={`Quitar bloque ${timeLabel}`}
                            title={`Quitar bloque ${timeLabel}`}
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex-1 min-h-0" aria-hidden />
                        <div
                          className="h-3 shrink-0 cursor-s-resize flex-shrink-0 z-30 relative"
                          aria-hidden
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            handlePointerDownBlock(ev, d.weekdayId, blockIndex, "bottom");
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {!hasBlocks && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground">
                      +
                    </span>
                  </div>
                )}
              </div>
              <div
                className="shrink-0"
                style={{ height: BODY_PADDING_BOTTOM }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>

      {/* Mobile: days as rows, time horizontal */}
      <div
        className="md:hidden space-y-2"
        onPointerMove={dragState?.layout === "mobile" ? handlePointerMove : undefined}
        onPointerUp={dragState ? handlePointerUp : undefined}
        onPointerLeave={dragState ? handlePointerUp : undefined}
      >
        {days.map((d) => {
          const blocks = availability[d.weekdayId] ?? [];
          const hasBlocks = blocks.length > 0;
          return (
            <div
              key={d.weekdayId}
              className="flex flex-col gap-1 rounded-md bg-background border border-border overflow-hidden"
            >
              <div className="flex items-center justify-between px-2 py-1.5 shrink-0">
                <span className="text-sm font-medium" title={d.dayOfWeek}>{d.dayOfWeek}</span>
                <span className="w-7 h-7 flex shrink-0 items-center justify-center" aria-hidden>
                  {hasBlocks ? (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveAllDay(e, d.weekdayId)}
                      className="rounded p-1.5 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 touch-manipulation -m-1.5"
                      aria-label={`Quitar todo ${d.dayOfWeek}`}
                      title={`Quitar todo ${d.dayOfWeek}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </span>
              </div>
              <div
                ref={(el) => {
                  mobileStripRefs.current[d.weekdayId] = el;
                }}
                data-weekday-id={d.weekdayId}
                className="relative cursor-pointer group w-full h-24 rounded border border-border bg-muted/30 overflow-hidden touch-none"
                onClick={(e) => handleMobileStripClick(e, d.weekdayId)}
                role="button"
                tabIndex={0}
                aria-label={
                  hasBlocks
                    ? `${d.dayOfWeek} ${blocks.length} bloque(s)`
                    : `Agregar disponibilidad ${d.dayOfWeek}`
                }
              >
                {/* 48 step cells: click target; no borders */}
                <div className="absolute inset-0 flex z-0" aria-hidden>
                  {Array.from({ length: STEPS_PER_DAY }, (_, step) => (
                    <div
                      key={step}
                      data-step={step}
                      data-weekday-id={d.weekdayId}
                      className="flex-1 min-w-0 h-full"
                    />
                  ))}
                </div>
                {/* Hour guides: vertical lines every 2 hours (full hours only) */}
                <div className="absolute inset-0 pointer-events-none flex" aria-hidden>
                  {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 border-r border-border/50 last:border-r-0"
                      style={{ width: `${100 / 12}%` }}
                    />
                  ))}
                </div>
                {!hasBlocks && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground">+ Toca para agregar</span>
                  </div>
                )}
                {blocks.map((range, blockIndex) => {
                  const startMinutes = parseHHMM(range.startLocal);
                  const endMinutes = parseHHMM(range.endLocal);
                  const leftPct = (startMinutes / TOTAL_MINUTES) * 100;
                  const widthPct = ((endMinutes - startMinutes) / TOTAL_MINUTES) * 100;
                  const timeLabel = `${range.startLocal}–${range.endLocal}`;
                  return (
                    <div
                      key={`${blockIndex}-${range.startLocal}-${range.endLocal}`}
                      data-availability-block
                      className="group/block rounded bg-primary/80 flex items-stretch cursor-grab active:cursor-grabbing z-10 min-w-[4px] relative"
                      style={{
                        position: "absolute",
                        top: 2,
                        bottom: 2,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      title={timeLabel}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(ev) =>
                        handlePointerDownBlockMobile(ev, d.weekdayId, blockIndex, "center")
                      }
                    >
                      <div
                        className="w-4 shrink-0 cursor-w-resize self-stretch touch-manipulation min-w-[20px] relative"
                        aria-hidden
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          handlePointerDownBlockMobile(ev, d.weekdayId, blockIndex, "left");
                        }}
                      />
                      <div className="flex-1 min-w-0" aria-hidden />
                      <div
                        className="w-4 shrink-0 cursor-e-resize self-stretch touch-manipulation min-w-[20px] relative"
                        aria-hidden
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          handlePointerDownBlockMobile(ev, d.weekdayId, blockIndex, "right");
                        }}
                      />
                      {/* Time + remove on top of handles so time is always visible */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 overflow-hidden pointer-events-none z-50"
                      >
                        <span className="text-[10px] font-medium text-primary-foreground tabular-nums leading-tight truncate w-full text-center">
                          {range.startLocal}
                        </span>
                        <span className="text-[10px] font-medium text-primary-foreground tabular-nums leading-tight truncate w-full text-center">
                          {range.endLocal}
                        </span>
                        <button
                          type="button"
                          onClick={(ev) => handleRemoveBlock(ev, d.weekdayId, blockIndex)}
                          className="shrink-0 rounded p-1 min-w-[28px] min-h-[28px] flex items-center justify-center text-primary-foreground/90 touch-manipulation pointer-events-auto"
                          aria-label={`Quitar ${timeLabel}`}
                          title={`Quitar ${timeLabel}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
