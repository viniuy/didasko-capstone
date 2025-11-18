import { format, isSameDay } from "date-fns";
import { Role } from "@/lib/types";

export interface EventDate {
  date: Date | null;
  fromTime: string;
  toTime: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  fromTime: string | null;
  toTime: string | null;
  role: Role;
}

export interface GroupedEvent {
  date: Date;
  items: EventItem[];
}

export interface EditData {
  id: string | null;
  title: string;
  description: string;
  date: Date | null;
  fromTime: string;
  toTime: string;
  dates: EventDate[];
}

export interface NewEvent {
  title: string;
  description: string;
  date: Date | null;
  fromTime: string;
  toTime: string;
  dates: EventDate[];
}

export function convertTo12Hour(time: string): string {
  if (!time) return "";

  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${minutes} ${ampm}`;
}

export function convertTo24Hour(time: string): string {
  if (!time) return "";

  const [timeStr, period] = time.split(" ");
  const [hours, minutes] = timeStr.split(":");
  let hour = parseInt(hours);

  if (period === "PM" && hour !== 12) {
    hour += 12;
  } else if (period === "AM" && hour === 12) {
    hour = 0;
  }

  return `${hour.toString().padStart(2, "0")}:${minutes}`;
}

export function validateTime(fromTime: string, toTime: string): boolean {
  if (!fromTime || !toTime) return true;
  return fromTime < toTime;
}

// Check for date and time conflicts between events
export function checkEventTimeConflicts(
  mainDate: Date | null,
  mainFromTime: string,
  mainToTime: string,
  additionalDates: EventDate[]
): { hasConflict: boolean; conflictMessage: string } {
  // If no time values or no main date, no conflicts
  if (!mainDate || (!mainFromTime && !mainToTime)) {
    return { hasConflict: false, conflictMessage: "" };
  }

  // Check conflicts with additional dates
  for (let i = 0; i < additionalDates.length; i++) {
    const additionalDate = additionalDates[i];
    if (!additionalDate.date) continue;

    // Check if dates are the same
    if (isSameDay(mainDate, additionalDate.date)) {
      // If same day, check time overlap
      if (
        additionalDate.fromTime &&
        additionalDate.toTime &&
        mainFromTime &&
        mainToTime
      ) {
        // Check for time overlap
        if (
          mainFromTime <= additionalDate.toTime &&
          mainToTime >= additionalDate.fromTime
        ) {
          return {
            hasConflict: true,
            conflictMessage: `Time conflict between main date and additional date #${
              i + 1
            }`,
          };
        }
      }
    }
  }

  // Check conflicts between additional dates
  for (let i = 0; i < additionalDates.length; i++) {
    const date1 = additionalDates[i];
    if (!date1.date || !date1.fromTime || !date1.toTime) continue;

    for (let j = i + 1; j < additionalDates.length; j++) {
      const date2 = additionalDates[j];
      if (!date2.date || !date2.fromTime || !date2.toTime) continue;

      // Check if dates are the same
      if (isSameDay(date1.date, date2.date)) {
        // Check for time overlap
        if (date1.fromTime <= date2.toTime && date1.toTime >= date2.fromTime) {
          return {
            hasConflict: true,
            conflictMessage: `Time conflict between additional dates #${
              i + 1
            } and #${j + 1}`,
          };
        }
      }
    }
  }

  return { hasConflict: false, conflictMessage: "" };
}

export function groupEventsByDate(events: any[]): GroupedEvent[] {
  const groupedEvents: Record<string, EventItem[]> = {};

  events.forEach((event: any) => {
    // Parse date from database (stored as UTC)
    const eventDate = new Date(event.date);
    // Use UTC methods to get the date components that were originally stored
    // This ensures Nov 20 UTC is read as Nov 20, not converted to local time
    const localDate = new Date(
      Date.UTC(
        eventDate.getUTCFullYear(),
        eventDate.getUTCMonth(),
        eventDate.getUTCDate()
      )
    );
    const dateKey = format(localDate, "yyyy-MM-dd");

    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = [];
    }

    groupedEvents[dateKey].push({
      id: event.id,
      title: event.title,
      description: event.description,
      date: localDate,
      fromTime: event.fromTime,
      toTime: event.toTime,
      role: event.role as Role,
    });
  });

  // Convert to array and sort by date
  const sortedEvents: GroupedEvent[] = Object.keys(groupedEvents).map(
    (dateKey) => {
      // Parse date key and create local date
      const [year, month, day] = dateKey.split("-").map(Number);
      const localDate = new Date(year, month - 1, day);
      return {
        date: localDate,
        items: groupedEvents[dateKey],
      };
    }
  );

  sortedEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  return sortedEvents;
}

export function formatTimeTo12Hour(time: string | null | undefined): string {
  if (!time) return "";

  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${minutes} ${ampm}`;
}
