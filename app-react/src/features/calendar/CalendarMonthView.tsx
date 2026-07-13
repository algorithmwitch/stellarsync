import { CalendarDayCell } from "@/features/calendar/CalendarDayCell";
import { toDateKey } from "@/features/calendar/calendar-utils";
import type { Post } from "@/types/posts";

type CalendarMonthViewProps = {
  days: Date[];
  anchor: Date;
  postsByDay: Map<string, Post[]>;
  onOpen(post: Post): void;
  onCreate(day: Date): void;
};

export function CalendarMonthView({ days, anchor, postsByDay, onOpen, onCreate }: CalendarMonthViewProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {days.map((day) => (
        <CalendarDayCell
          key={day.toISOString()}
          day={day}
          inCurrentMonth={day.getMonth() === anchor.getMonth()}
          posts={postsByDay.get(toDateKey(day)) || []}
          onOpen={onOpen}
          onCreate={onCreate}
        />
      ))}
    </section>
  );
}
