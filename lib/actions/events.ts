"use server";

import { prisma } from "@/lib/db";
import { Role } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";

// Strongly typed Event model
type EventModel = typeof prisma.event; // Adjust if your model is named differently

const getEventModel = (): EventModel => {
  if ("Event" in prisma) return prisma.Event as EventModel;
  if ("event" in prisma) return prisma.event as EventModel;
  throw new Error("Event model not found in Prisma client");
};

// Normalize date to start of day while preserving local date
// Uses UTC to ensure the date doesn't shift when stored in database
function normalizeDate(date: Date): Date {
  // Get local date components
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Create date using UTC to preserve the local date value
  // This ensures Nov 20 stays as Nov 20 when stored in UTC
  const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return utcDate;
}

export async function getEvents() {
  try {
    const Event = getEventModel();

    const events = await Event.findMany({
      orderBy: { date: "asc" },
    });

    return { events, error: null };
  } catch (error: any) {
    console.error("Failed to fetch events:", error);
    return { events: [], error: error?.message || "Failed to fetch events" };
  }
}

type EventData = {
  title: string;
  description?: string | null;
  date: Date;
  fromTime?: string | null;
  toTime?: string | null;
  userRole: Role;
};

export async function addEvent(data: EventData) {
  const { title, description, date, fromTime, toTime, userRole } = data;

  if (userRole !== Role.ACADEMIC_HEAD && userRole !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const Event = getEventModel();
    const normalizedDate = normalizeDate(date);

    const event = await Event.create({
      data: {
        title,
        description: description || null,
        date: normalizedDate,
        fromTime: fromTime || null,
        toTime: toTime || null,
        role: userRole,
      },
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/academic-head");

    return { success: true, event, error: null };
  } catch (error: any) {
    console.error("Failed to add event:", error);
    return { success: false, error: error?.message || "Failed to add event" };
  }
}

type UpdateEventData = EventData & { id: string };

export async function updateEvent(data: UpdateEventData) {
  const { id, title, description, date, fromTime, toTime, userRole } = data;

  if (userRole !== Role.ACADEMIC_HEAD && userRole !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const Event = getEventModel();
    const normalizedDate = normalizeDate(date);

    const event = await Event.update({
      where: { id },
      data: {
        title,
        description: description || null,
        date: normalizedDate,
        fromTime: fromTime || null,
        toTime: toTime || null,
      },
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/academic-head");

    return { success: true, event, error: null };
  } catch (error: any) {
    console.error("Failed to update event:", error);
    return {
      success: false,
      error: error?.message || "Failed to update event",
    };
  }
}

export async function deleteEvent({
  id,
  userRole,
}: {
  id: string;
  userRole: Role;
}) {
  if (userRole !== Role.ACADEMIC_HEAD && userRole !== Role.ADMIN) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const Event = getEventModel();

    await Event.delete({ where: { id } });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/academic-head");

    return { success: true, error: null };
  } catch (error: any) {
    console.error("Failed to delete event:", error);
    return {
      success: false,
      error: error?.message || "Failed to delete event",
    };
  }
}
