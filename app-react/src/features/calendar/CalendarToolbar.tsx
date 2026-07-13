import type { CalendarViewMode } from "@/features/calendar/calendar-utils";

type CalendarToolbarProps = {
  label: string;
  view: CalendarViewMode;
  onViewChange(next: CalendarViewMode): void;
  onPrevious(): void;
  onToday(): void;
  onNext(): void;
};

export function CalendarToolbar({
  label,
  view,
  onViewChange,
  onPrevious,
  onToday,
  onNext,
}: CalendarToolbarProps) {
  return (
    <div className="stellar-panel flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-2">
        <div className="stellar-eyebrow">Calendar</div>
        <h2 className="m-0 text-2xl font-semibold text-stellar-text-strong">{label}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-stellar-border bg-white/5 p-1">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm ${view === "month" ? "bg-white/10 text-stellar-text-strong" : "text-stellar-muted"}`}
            onClick={() => onViewChange("month")}
          >
            Month
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm ${view === "week" ? "bg-white/10 text-stellar-text-strong" : "text-stellar-muted"}`}
            onClick={() => onViewChange("week")}
          >
            Week
          </button>
        </div>
        <button type="button" className="stellar-nav-link" onClick={onPrevious}>
          Previous
        </button>
        <button type="button" className="stellar-nav-link" onClick={onToday}>
          Today
        </button>
        <button type="button" className="stellar-nav-link" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}
