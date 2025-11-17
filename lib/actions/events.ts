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

// Normalize date to start of day while preserving local timezone
function normalizeDate(date: Date): Date {
  // Use local timezone components to avoid UTC conversion
  // This ensures the date represents the local date, not UTC
  const localDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  );
  return localDate;
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

  if (userRole !== Role.ACADEMIC_HEAD) {
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

  if (userRole !== Role.ACADEMIC_HEAD) {
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
  if (userRole !== Role.ACADEMIC_HEAD) {
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
