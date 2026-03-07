"use client";

export interface CalendarGridProps {
  year: number;
  month: number;
  today: string;
  entryDates: Set<string>;
  filteredDateSet: Set<string>;
  forEveryoneSet: Set<string>;
  hasActiveFilter: boolean;
  hasDependentRoleOnDate: (date: string) => boolean;
  hasRelevantRoleOnDate: (date: string) => boolean;
  isPast: (date: string) => boolean;
  onSelectDate: (date: string) => void;
  t: (key: string) => string;
}

const CAL_DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

export function CalendarGrid({
  year,
  month,
  today,
  entryDates,
  filteredDateSet,
  forEveryoneSet,
  hasActiveFilter,
  hasDependentRoleOnDate,
  hasRelevantRoleOnDate,
  isPast,
  onSelectDate,
  t,
}: CalendarGridProps) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = firstDayDow === 0 ? 6 : firstDayDow - 1;

  return (
    <div className="max-w-md mx-auto mb-10">
      <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-4">
        {t("calendar")}
      </h2>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {CAL_DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const hasAnyAssignment = entryDates.has(dateStr);
          const matchesFilter = filteredDateSet.has(dateStr);
          const isForEveryoneDay = forEveryoneSet.has(dateStr);
          const isToday = dateStr === today;
          const past = isPast(dateStr);
          const hasContent = hasAnyAssignment || isForEveryoneDay;
          const dimmed =
            hasActiveFilter && hasContent && !matchesFilter;
          const isHighlighted =
            hasDependentRoleOnDate(dateStr) || hasRelevantRoleOnDate(dateStr);

          return (
            <button
              key={dayNum}
              onClick={() => {
                if (hasContent) onSelectDate(dateStr);
              }}
              disabled={!hasContent}
              className={[
                "aspect-square rounded-md flex items-center justify-center text-sm transition-colors relative",
                past ? "opacity-50" : "",
                isToday ? "ring-1 ring-foreground" : "",
                dimmed
                  ? "opacity-30"
                  : isHighlighted
                    ? "bg-foreground/15 font-semibold"
                    : hasAnyAssignment
                      ? "bg-muted/50 font-medium"
                      : isForEveryoneDay
                        ? "border border-dashed border-border"
                        : "text-muted-foreground",
                hasContent
                  ? "cursor-pointer hover:bg-muted/70 active:bg-muted"
                  : "cursor-default",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {dayNum}
              {isHighlighted && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
