export interface WeekdayOption {
  weekdayId: number;
  dayOfWeek: string;
}

export type AvailabilityBlock = { startLocal: string; endLocal: string };

export interface AvailabilityWeekGridProps {
  days: WeekdayOption[];
  availability: Record<number, AvailabilityBlock[]>;
  onChange: (availability: Record<number, AvailabilityBlock[]>) => void;
  gridHeight?: number;
}
