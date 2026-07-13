import type { CalendarRange } from "@/types/posts";

export type CalendarViewMode = "month" | "week";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getMonthRange(anchor: Date): CalendarRange {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function getWeekRange(anchor: Date): CalendarRange {
  const current = new Date(anchor);
  const day = current.getDay();
  const start = new Date(current);
  start.setDate(current.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function shiftAnchor(anchor: Date, view: CalendarViewMode, direction: -1 | 1) {
  const next = new Date(anchor);
  if (view === "week") {
    next.setDate(next.getDate() + direction * 7);
  } else {
    next.setMonth(next.getMonth() + direction);
  }
  return next;
}

export function getVisibleDays(anchor: Date, view: CalendarViewMode) {
  if (view === "week") {
    const range = getWeekRange(anchor);
    const start = new Date(`${range.start}T12:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      return next;
    });
  }

  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}
