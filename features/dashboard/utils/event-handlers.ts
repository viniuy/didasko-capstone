import { Role } from "@/lib/types";
import {
  EditData,
  EventItem,
  NewEvent,
  validateTime,
  checkEventTimeConflicts,
} from "./event-utils";
import {
  addEvent,
  deleteEvent,
  getEvents,
  updateEvent,
} from "@/lib/actions/events";
import { startOfDay, isPast, isSameDay } from "date-fns";

// Function to normalize date by removing time portion while preserving local timezone
function normalizeDate(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  // Get local date components
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  // Create date using UTC to preserve the local date value
  // This ensures Nov 20 stays as Nov 20 when stored in UTC
  const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return utcDate;
}

export async function handleSaveNewEvent({
  newEvent,
  userRole,
  onSuccess,
  onError,
}: {
  newEvent: NewEvent;
  userRole: Role | undefined;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}) {
  if (!userRole) {
    onError("You must be logged in to add events");
    return;
  }

  if (userRole !== Role.ADMIN && userRole !== Role.ACADEMIC_HEAD) {
    onError("Only Academic Head can add events");
    return;
  }

  if (!newEvent.title) {
    onError("Title is required.");
    return;
  }

  if (!newEvent.date && newEvent.dates.length === 0) {
    onError("At least one date is required.");
    return;
  }

  // Check if trying to add an event in the past
  if (newEvent.date) {
    const now = new Date();
    const eventDate = new Date(newEvent.date);

    // If it's today's date, check if the time is in the future
    if (isSameDay(eventDate, now)) {
      if (newEvent.fromTime) {
        const [hours, minutes] = newEvent.fromTime.split(":").map(Number);
        const eventTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes
        );

        // Add a 5-minute buffer
        const bufferTime = new Date(now.getTime() + 5 * 60000);

        if (eventTime.getTime() <= bufferTime.getTime()) {
          onError("Start time must be 5 minutes from now");
          return;
        }
      }
    } else if (isPast(startOfDay(eventDate))) {
      onError("Cannot add events in the past");
      return;
    }
  }

  // Check if any additional dates are in the past
  for (let i = 0; i < newEvent.dates.length; i++) {
    const dateItem = newEvent.dates[i];
    if (dateItem.date) {
      const now = new Date();
      const eventDate = new Date(dateItem.date);

      // If it's today's date, check if the time is in the future
      if (isSameDay(eventDate, now)) {
        if (dateItem.fromTime) {
          const [hours, minutes] = dateItem.fromTime.split(":").map(Number);
          const eventTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hours,
            minutes
          );

          // Add a 5-minute buffer
          const bufferTime = new Date(now.getTime() + 5 * 60000);

          if (eventTime.getTime() <= bufferTime.getTime()) {
            onError(
              `Additional date #${i + 1} start time must be 5 minutes from now`
            );
            return;
          }
        }
      } else if (isPast(startOfDay(eventDate))) {
        onError(`Additional date #${i + 1} cannot be in the past`);
        return;
      }
    }
  }

  // Validate main date and time if provided
  if (newEvent.fromTime && newEvent.toTime) {
    if (!validateTime(newEvent.fromTime, newEvent.toTime)) {
      onError("Invalid time range for main date.");
      return;
    }
  }

  // Validate additional dates and times
  for (let i = 0; i < newEvent.dates.length; i++) {
    const dateItem = newEvent.dates[i];
    if (!dateItem.date) {
      onError(`Date is required for additional date #${i + 1}.`);
      return;
    }

    if (dateItem.fromTime && dateItem.toTime) {
      if (!validateTime(dateItem.fromTime, dateItem.toTime)) {
        onError(`Invalid time range for additional date #${i + 1}.`);
        return;
      }
    }
  }

  // Check for date/time conflicts
  const conflictCheck = checkEventTimeConflicts(
    newEvent.date,
    newEvent.fromTime,
    newEvent.toTime,
    newEvent.dates
  );

  if (conflictCheck.hasConflict) {
    onError(conflictCheck.conflictMessage);
    return;
  }

  try {
    // First, create the main event
    if (newEvent.date) {
      // Normalize the date to remove time information
      const normalizedDate = normalizeDate(newEvent.date);
      console.log("Adding main event with normalized date:", normalizedDate);

      // Add event to database
      const result = await addEvent({
        title: newEvent.title,
        description: newEvent.description || null,
        date: normalizedDate,
        fromTime: newEvent.fromTime || null,
        toTime: newEvent.toTime || null,
        userRole,
      });

      if (!result.success) {
        onError(result.error || "Failed to add main event");
        return { success: false };
      }
    }

    // Then create all additional dates as separate events
    for (const dateItem of newEvent.dates) {
      if (dateItem.date) {
        // Normalize the date
        const normalizedDate = normalizeDate(dateItem.date);
        console.log(
          "Adding additional event with normalized date:",
          normalizedDate
        );

        // Add event to database
        const result = await addEvent({
          title: newEvent.title,
          description: newEvent.description || null,
          date: normalizedDate,
          fromTime: dateItem.fromTime || null,
          toTime: dateItem.toTime || null,
          userRole,
        });

        if (!result.success) {
          onError(`Failed to add additional event: ${result.error}`);
          // Continue adding other dates even if one fails
        }
      }
    }

    onSuccess("Event(s) added successfully");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add events:", error);
    onError(`Failed to add event: ${error?.message || "Unknown error"}`);
    return { success: false };
  }
}

export async function handleDeleteEvent({
  eventId,
  userRole,
  onSuccess,
  onError,
}: {
  eventId: string;
  userRole: Role | undefined;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}) {
  if (!userRole) {
    onError("You must be logged in to delete events");
    return;
  }

  if (userRole !== Role.ADMIN && userRole !== Role.ACADEMIC_HEAD) {
    onError("Only Academic Head can delete events");
    return;
  }

  // Delete event from database
  const result = await deleteEvent({
    id: eventId,
    userRole,
  });

  if (!result.success) {
    onError(result.error || "Failed to delete event");
    return { success: false };
  }

  onSuccess("Event deleted successfully");
  return { success: true };
}

export async function handleUpdateEvent({
  editData,
  userRole,
  onSuccess,
  onError,
}: {
  editData: EditData;
  userRole: Role | undefined;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}) {
  if (!userRole) {
    onError("You must be logged in to update events");
    return;
  }

  if (userRole !== Role.ADMIN && userRole !== Role.ACADEMIC_HEAD) {
    onError("Only Academic Head can edit events");
    return;
  }

  if (!editData.id) {
    onError("Event ID is required.");
    return;
  }

  if (!editData.title) {
    onError("Title is required.");
    return;
  }

  if (!editData.date) {
    onError("Date is required.");
    return;
  }

  // Check if trying to update to a past date
  if (editData.date) {
    const now = new Date();
    const eventDate = new Date(editData.date);

    // If it's today's date, check if the time is in the future
    if (isSameDay(eventDate, now)) {
      if (editData.fromTime) {
        const [hours, minutes] = editData.fromTime.split(":").map(Number);
        const eventTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes
        );

        // Add a 5-minute buffer
        const bufferTime = new Date(now.getTime() + 5 * 60000);

        if (eventTime.getTime() <= bufferTime.getTime()) {
          onError("Start time must be 5 minutes from now");
          return;
        }
      }
    } else if (isPast(startOfDay(eventDate))) {
      onError("Cannot set event date to a past date");
      return;
    }
  }

  // Validate times if provided
  if (editData.fromTime && editData.toTime) {
    if (!validateTime(editData.fromTime, editData.toTime)) {
      onError("Invalid time range.");
      return;
    }
  }

  // Check for date/time conflicts in additional dates
  const conflictCheck = checkEventTimeConflicts(
    editData.date,
    editData.fromTime,
    editData.toTime,
    editData.dates
  );

  if (conflictCheck.hasConflict) {
    onError(conflictCheck.conflictMessage);
    return;
  }

  // Normalize the date to remove time information
  const normalizedDate = normalizeDate(editData.date);
  console.log("Updating event with normalized date:", normalizedDate);

  // Update event in database
  const result = await updateEvent({
    id: editData.id,
    title: editData.title,
    description: editData.description || null,
    date: normalizedDate,
    fromTime: editData.fromTime || null,
    toTime: editData.toTime || null,
    userRole,
  });

  if (!result.success) {
    onError(result.error || "Failed to update event");
    return { success: false };
  }

  onSuccess("Event updated successfully");
  return { success: true };
}

export function canUserManageEvents(userRole: Role | undefined): boolean {
  return userRole === Role.ACADEMIC_HEAD || userRole === Role.ADMIN;
}
