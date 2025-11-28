"use client";

import { Clock, Trash, Edit, Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AnimatedContent from "@/components/ui/AnimatedContent";
import { gsap } from "gsap";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { format, isSameDay, isBefore, isAfter } from "date-fns";
import { CalendarIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { Role } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getEvents } from "@/lib/actions/events";

import {
  EventItem,
  GroupedEvent,
  EditData,
  NewEvent,
  validateTime,
  groupEventsByDate,
  formatTimeTo12Hour,
} from "../utils/event-utils";

import {
  canUserManageEvents,
  handleDeleteEvent,
  handleSaveNewEvent,
  handleUpdateEvent,
} from "../utils/event-handlers";

export default function UpcomingEvents() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role as Role | undefined;
  const todayRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);

  const [eventList, setEventList] = useState<GroupedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [alert, setAlert] = useState<{
    show: boolean;
    title: string;
    description: string;
    variant: "success" | "error";
  }>({
    show: false,
    title: "",
    description: "",
    variant: "success",
  });

  // Check if user is authorized to manage events
  const canManageEvents = canUserManageEvents(userRole);

  const [openDelete, setOpenDelete] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const eventRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [openConfirmSave, setOpenConfirmSave] = useState(false);
  const [eventsToSave, setEventsToSave] = useState<{
    type: "new" | "edit";
    data: NewEvent | EditData;
  } | null>(null);

  const [openEdit, setOpenEdit] = useState(false);
  const [openEditDatePicker, setOpenEditDatePicker] = useState(false);
  const [editData, setEditData] = useState<EditData>({
    id: null,
    title: "",
    description: "",
    date: null,
    fromTime: "",
    toTime: "",
    dates: [],
  });

  const [openAdd, setOpenAdd] = useState(false);
  const [openAddDatePicker, setOpenAddDatePicker] = useState(false);
  const [openAdditionalDatePickers, setOpenAdditionalDatePickers] = useState<
    boolean[]
  >([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openUnsavedChanges, setOpenUnsavedChanges] = useState(false);
  const [pendingAction, setPendingAction] = useState<"open" | "close" | null>(
    null
  );
  const [newEvent, setNewEvent] = useState<NewEvent>({
    title: "",
    description: "",
    date: null,
    fromTime: "",
    toTime: "",
    dates: [],
  });

  const [dateError, setDateError] = useState<string>("");
  const [timeError, setTimeError] = useState<string>("");

  // Function to show alert notifications
  const showAlert = (
    title: string,
    description: string,
    variant: "success" | "error" = "success"
  ) => {
    if (variant === "success") {
      toast.success(description);
    } else {
      toast.error(description);
    }
  };

  // Function to refresh events
  const refreshEvents = async () => {
    const { events, error } = await getEvents();

    if (error) {
      toast.error(error);
      return false;
    }

    setEventList(groupEventsByDate(events));
    return true;
  };

  // Fetch events from database (only once on mount)
  useEffect(() => {
    if (hasFetchedRef.current) return;

    const fetchEvents = async () => {
      setIsLoading(true);
      await refreshEvents();
      setIsLoading(false);
      hasFetchedRef.current = true;
    };

    fetchEvents();
  }, []);

  // Add new useEffect for scrolling to today's events
  useEffect(() => {
    if (!isLoading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isLoading]);

  function validateDateTime(
    date: Date | null,
    fromTime: string,
    toTime: string
  ): boolean {
    if (!date) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check if date is in the past
    if (isBefore(date, today)) {
      setDateError("Cannot select a past date");
      return false;
    }

    // Only check time requirements if we have both date and time
    if (isSameDay(date, today) && fromTime) {
      const [hours, minutes] = fromTime.split(":").map(Number);
      const selectedTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes
      );

      // Add a 5-minute buffer to allow for event creation
      const bufferTime = new Date(now.getTime() + 5 * 60000);

      if (selectedTime.getTime() <= bufferTime.getTime()) {
        setTimeError("Start time must be 5 minutes from now");
        return false;
      }
    }

    setDateError("");
    setTimeError("");
    return true;
  }

  function handleTimeChange(
    event: React.ChangeEvent<HTMLInputElement>,
    isFromTime: boolean
  ) {
    const newTime = event.target.value;
    const currentFromTime = isFromTime ? newTime : newEvent.fromTime;
    const currentToTime = isFromTime ? newEvent.toTime : newTime;

    if (!validateTime(currentFromTime, currentToTime)) {
      setTimeError("End time cannot be earlier than start time");
    } else if (
      !validateDateTime(newEvent.date, currentFromTime, currentToTime)
    ) {
      // Error message already set by validateDateTime
    } else {
      setTimeError("");
    }

    setNewEvent((prev) => ({
      ...prev,
      [isFromTime ? "fromTime" : "toTime"]: newTime,
    }));
  }

  function handleEditTimeChange(
    event: React.ChangeEvent<HTMLInputElement>,
    isFromTime: boolean
  ) {
    const newTime = event.target.value;
    const currentFromTime = isFromTime ? newTime : editData.fromTime;
    const currentToTime = isFromTime ? editData.toTime : newTime;

    if (!validateTime(currentFromTime, currentToTime)) {
      setTimeError("End time cannot be earlier than start time");
    } else if (
      !validateDateTime(editData.date, currentFromTime, currentToTime)
    ) {
      // Error message already set by validateDateTime
    } else {
      setTimeError("");
    }

    setEditData((prev) => ({
      ...prev,
      [isFromTime ? "fromTime" : "toTime"]: newTime,
    }));
  }

  // Add this function to check for event conflicts
  function checkEventConflict(
    date: Date,
    fromTime: string,
    toTime: string,
    excludeEventId?: string,
    eventTitle?: string
  ): boolean {
    const sameDayEvents =
      eventList.find((event) => isSameDay(event.date, date))?.items ?? [];

    return sameDayEvents.some((event) => {
      // Skip the event being edited
      if (excludeEventId && event.id === excludeEventId) return false;

      // If either event is all-day, there's a conflict only if titles match
      if ((!fromTime && !toTime) || (!event.fromTime && !event.toTime)) {
        return eventTitle === event.title;
      }

      // If one event has time and the other doesn't, there's a conflict only if titles match
      if ((!fromTime || !toTime) !== (!event.fromTime || !event.toTime)) {
        return eventTitle === event.title;
      }

      // If both events have times, check for overlap and title match
      if (fromTime && toTime && event.fromTime && event.toTime) {
        const newStart = fromTime;
        const newEnd = toTime;
        const existingStart = event.fromTime;
        const existingEnd = event.toTime;

        const timeOverlap = !(
          newEnd <= existingStart || newStart >= existingEnd
        );
        return timeOverlap && eventTitle === event.title;
      }

      return false;
    });
  }

  // Add function to reset new event form
  const resetNewEventForm = () => {
    setNewEvent({
      title: "",
      description: "",
      date: null,
      fromTime: "",
      toTime: "",
      dates: [],
    });
    setOpenAdditionalDatePickers([]);
    setHasUnsavedChanges(false);
  };

  // Add function to check for unsaved changes
  const hasChanges = (event: NewEvent) => {
    return (
      event.title !== "" ||
      event.description !== "" ||
      event.date !== null ||
      event.fromTime !== "" ||
      event.toTime !== "" ||
      event.dates.length > 0
    );
  };

  // Function to handle opening the add modal
  function handleOpenAdd() {
    if (hasUnsavedChanges) {
      setPendingAction("open");
      setOpenUnsavedChanges(true);
    } else {
      setOpenAdd(true);
      setAlert({ show: false, title: "", description: "", variant: "success" });
      setHasAttemptedSave(false);
    }
  }

  // Add function to handle unsaved changes response
  const handleUnsavedChangesResponse = (keepChanges: boolean) => {
    if (!keepChanges) {
      resetNewEventForm();
    }

    if (pendingAction === "open") {
      setOpenAdd(true);
      setAlert({ show: false, title: "", description: "", variant: "success" });
      setHasAttemptedSave(false);
    } else if (pendingAction === "close") {
      setOpenAdd(false);
    }

    setOpenUnsavedChanges(false);
    setPendingAction(null);
  };

  // Modify the newEvent state updates to track changes
  useEffect(() => {
    setHasUnsavedChanges(hasChanges(newEvent));
  }, [newEvent]);

  // Function to handle edit click
  function handleEditClick(event: EventItem) {
    // Ensure date is properly converted to local Date object
    let eventDate: Date | null = null;
    if (event.date) {
      // If it's already a Date object, use it directly
      if (event.date instanceof Date) {
        eventDate = new Date(event.date);
      } else {
        // If it's a string, parse it and create a local date
        const parsedDate = new Date(event.date);
        // Create a new date in local timezone to avoid UTC conversion issues
        eventDate = new Date(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          parsedDate.getDate()
        );
      }
    }

    setEditData({
      id: event.id,
      title: event.title,
      description: event.description || "",
      date: eventDate,
      fromTime: event.fromTime || "",
      toTime: event.toTime || "",
      dates: [],
    });
    setOpenEdit(true);
  }

  // Function to handle delete click
  function handleDeleteClick(eventId: string) {
    setEventToDelete(eventId);
    setOpenDelete(true);
  }

  // Function to handle opening edit modal
  function handleOpenEdit(event: EventItem) {
    // Ensure date is properly converted to local Date object
    let eventDate: Date | null = null;
    if (event.date) {
      // If it's already a Date object, use it directly
      if (event.date instanceof Date) {
        eventDate = new Date(event.date);
      } else {
        // If it's a string, parse it and create a local date
        const parsedDate = new Date(event.date);
        // Create a new date in local timezone to avoid UTC conversion issues
        eventDate = new Date(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          parsedDate.getDate()
        );
      }
    }

    setEditData({
      id: event.id,
      title: event.title,
      description: event.description || "",
      date: eventDate,
      fromTime: event.fromTime || "",
      toTime: event.toTime || "",
      dates: [],
    });
    setOpenEdit(true);
    setAlert({ show: false, title: "", description: "", variant: "success" });
    setHasAttemptedSave(false);
  }

  // Function to handle delete confirmation
  async function confirmDelete() {
    if (!eventToDelete) return;

    if (!canManageEvents) {
      toast.error("Only Academic Head or Admin can manage events");
      return;
    }

    try {
      setOpenDelete(false);
      setDeletingEventId(eventToDelete);

      // Get the event element
      const eventElement = eventRefs.current.get(eventToDelete);
      if (eventElement) {
        // Animate slide to the right
        await gsap.to(eventElement, {
          x: 150,
          opacity: 0,
          scale: 0.8,
          duration: 0.5,
          ease: "power3.in",
        });
      }

      // Delete the event after animation
      const result = await handleDeleteEvent({
        eventId: eventToDelete,
        userRole,
        onSuccess: (message) => toast.success(message),
        onError: (error) => toast.error(error),
      });

      if (result?.success) {
        await refreshEvents();
        setEventToDelete(null);
        setDeletingEventId(null);
      } else {
        setDeletingEventId(null);
      }
    } catch (error) {
      setDeletingEventId(null);
    }
  }

  // Function to handle edit save
  async function saveEdit() {
    if (isSaving) return;

    if (!canManageEvents) {
      toast.error("Only Academic Head or Admin can manage events");
      return;
    }

    if (!validateDateTime(editData.date, editData.fromTime, editData.toTime)) {
      return;
    }

    // Check for conflicts, excluding the current event being edited
    if (
      editData.date &&
      editData.id &&
      checkEventConflict(
        editData.date,
        editData.fromTime,
        editData.toTime,
        editData.id,
        editData.title
      )
    ) {
      setAlert({
        show: true,
        title: "Error",
        description:
          "There is already an event with the same title scheduled for this date and time.",
        variant: "error",
      });
      return;
    }

    setEventsToSave({ type: "edit", data: editData });
    setOpenConfirmSave(true);
  }

  // Function to save new event
  async function saveNewEvent() {
    if (isSaving) return;

    if (!canManageEvents) {
      toast.error("Only Academic Head or Admin can manage events");
      return;
    }

    if (!validateDateTime(newEvent.date, newEvent.fromTime, newEvent.toTime)) {
      return;
    }

    // Check for conflicts
    if (
      newEvent.date &&
      checkEventConflict(
        newEvent.date,
        newEvent.fromTime,
        newEvent.toTime,
        undefined,
        newEvent.title
      )
    ) {
      setAlert({
        show: true,
        title: "Error",
        description:
          "There is already an event with the same title scheduled for this date and time.",
        variant: "error",
      });
      return;
    }

    setEventsToSave({ type: "new", data: newEvent });
    setOpenConfirmSave(true);
  }

  // Function to confirm save
  async function confirmSave() {
    if (!eventsToSave) return;
    setIsSaving(true);
    setHasAttemptedSave(true);
    setAlert({ show: false, title: "", description: "", variant: "success" });

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    const timeout = setTimeout(async () => {
      try {
        if (eventsToSave.type === "new") {
          const result = await handleSaveNewEvent({
            newEvent: eventsToSave.data as NewEvent,
            userRole,
            onSuccess: (message) => {
              toast.success("Event created successfully");
              refreshEvents();
              setIsSaving(false);
              setOpenAdd(false);
              setOpenConfirmSave(false);
              setEventsToSave(null);
              resetNewEventForm(); // Clear the form
            },
            onError: (error) => {
              setAlert({
                show: true,
                title: "Error",
                description: error,
                variant: "error",
              });
              setIsSaving(false);
            },
          });
        } else {
          const result = await handleUpdateEvent({
            editData: eventsToSave.data as EditData,
            userRole,
            onSuccess: (message) => {
              toast.success("Event updated successfully");
              refreshEvents();
              setIsSaving(false);
              setOpenEdit(false);
              setOpenConfirmSave(false);
              setEventsToSave(null);
            },
            onError: (error) => {
              setAlert({
                show: true,
                title: "Error",
                description: error,
                variant: "error",
              });
              setIsSaving(false);
            },
          });
        }
      } catch (error) {
        setAlert({
          show: true,
          title: "Error",
          description: "Failed to save event. Please try again.",
          variant: "error",
        });
        setIsSaving(false);
      }
    }, 500);

    setSaveTimeout(timeout);
  }

  // Add new date to the event
  function addNewDate() {
    setNewEvent((prev) => ({
      ...prev,
      dates: [
        ...prev.dates,
        {
          date: null,
          fromTime: "",
          toTime: "",
        },
      ],
    }));
    setOpenAdditionalDatePickers((prev) => [...prev, false]);
  }

  // Remove a date from the event
  function removeDate(index: number) {
    setNewEvent((prev) => ({
      ...prev,
      dates: prev.dates.filter((_, i) => i !== index),
    }));
    setOpenAdditionalDatePickers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAdditionalDateChange(index: number, date: Date | null) {
    setNewEvent((prev) => {
      const newDates = [...prev.dates];
      newDates[index] = { ...newDates[index], date };
      return { ...prev, dates: newDates };
    });
  }

  function handleAdditionalTimeChange(
    index: number,
    value: string,
    isFromTime: boolean
  ) {
    setNewEvent((prev) => {
      const newDates = [...prev.dates];
      if (isFromTime) {
        newDates[index] = { ...newDates[index], fromTime: value };
      } else {
        newDates[index] = { ...newDates[index], toTime: value };
      }
      return { ...prev, dates: newDates };
    });
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  // Add validation function
  const hasIncompleteDates = (eventData: NewEvent | EditData): boolean => {
    // Check main date
    if (!eventData.date) return true;

    // Check additional dates if they exist
    if ("dates" in eventData && eventData.dates.length > 0) {
      return eventData.dates.some((date) => !date.date);
    }

    return false;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-semibold text-[#FAEDCB]">Events</h2>
        {canManageEvents && (
          <Button
            variant="ghost"
            size="icon"
            className="text-[#FAEDCB] hover:text-white hover:bg-[#0a2f42]"
            onClick={handleOpenAdd}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="flex-1 bg-white rounded-lg p-2 shadow-md overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#124A69] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0a2f42]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-[#124A69]" />
          </div>
        ) : eventList.length > 0 ? (
          <div className="space-y-2 mt-2">
            {eventList.map((event, eventIndex) => {
              const isToday = isSameDay(event.date, new Date());
              return (
                <div key={eventIndex} ref={isToday ? todayRef : null}>
                  <div className="flex items-center gap-2 text-[#124A69] mb-1">
                    <p className="text-xs">
                      {event.date
                        ? format(event.date, "MMMM d, yyyy")
                        : "Invalid date"}{" "}
                      ({event.date ? format(event.date, "EEEE") : "Invalid day"}
                      )
                    </p>
                  </div>
                  {event.items.map((item, itemIndex) => {
                    const isPastEvent = isBefore(
                      event.date,
                      new Date(new Date().setHours(0, 0, 0, 0))
                    );
                    return (
                      <AnimatedContent
                        key={item.id}
                        distance={150}
                        direction="horizontal"
                        reverse={true}
                        duration={1.2}
                        ease="power3.out"
                        initialOpacity={0.2}
                        animateOpacity
                        scale={1.1}
                        threshold={0.2}
                        delay={0.3 + itemIndex * 0.1}
                        container="snap-main-container"
                        onComplete={() => {}}
                        onDisappearanceComplete={() => {}}
                      >
                        <div
                          ref={(el) => {
                            if (el) {
                              eventRefs.current.set(item.id, el);
                            } else {
                              eventRefs.current.delete(item.id);
                            }
                          }}
                        >
                          <Card
                            className={cn(
                              "border-l-[8px] mb-1 hover:shadow-md transition-shadow",
                              isPastEvent
                                ? "border-gray-400 bg-gray-50"
                                : "border-[#124A69]"
                            )}
                          >
                            <CardContent className="p-2 relative">
                              {canManageEvents && (
                                <div className="absolute right-1 -top-5 flex gap-0.5">
                                  <Button
                                    variant="ghost"
                                    className="h-5 w-5 p-0 hover:bg-transparent"
                                    onClick={() => handleOpenEdit(item)}
                                  >
                                    <Edit
                                      className="h-3 w-3"
                                      color={
                                        isPastEvent ? "#6b7280" : "#124a69"
                                      }
                                    />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="h-5 w-5 p-0 hover:bg-transparent"
                                    onClick={() => handleDeleteClick(item.id)}
                                  >
                                    <Trash
                                      className="h-3 w-3"
                                      color={
                                        isPastEvent ? "#6b7280" : "#124a69"
                                      }
                                    />
                                  </Button>
                                </div>
                              )}
                              <div className="-mt-4 -mb-4">
                                <div
                                  className={cn(
                                    "font-medium text-xs mb-0.5",
                                    isPastEvent
                                      ? "text-gray-500"
                                      : "text-[#124A69]"
                                  )}
                                >
                                  {item.title}
                                </div>
                                <div
                                  className={cn(
                                    "text-[11px]",
                                    isPastEvent
                                      ? "text-gray-400"
                                      : "text-gray-600"
                                  )}
                                >
                                  {item.description}
                                </div>
                                <div
                                  className={cn(
                                    "flex items-center text-[11px]",
                                    isPastEvent
                                      ? "text-gray-400"
                                      : "text-gray-500"
                                  )}
                                >
                                  <Clock className="w-3 h-3 mr-0.5" />
                                  {item.fromTime && item.toTime
                                    ? `${formatTimeTo12Hour(
                                        item.fromTime
                                      )} - ${formatTimeTo12Hour(item.toTime)}`
                                    : "All day"}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </AnimatedContent>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-gray-500 text-xs text-center">No events.</p>
          </div>
        )}
      </div>

      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setOpenDelete(false)}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 h-8 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-[#124A69] text-white hover:bg-[#0a2f42] h-8 text-xs"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openEdit}
        onOpenChange={(open) => {
          if (!open && (isSaving || alert.show || !hasAttemptedSave)) {
            return;
          }
          setOpenEdit(open);
          if (open) {
            setAlert({
              show: false,
              title: "",
              description: "",
              variant: "success",
            });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Event</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2">
            {alert.show && alert.variant === "error" && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  {alert.description}
                </AlertDescription>
              </Alert>
            )}
            <Label className="text-medium">
              Title<span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Title"
              value={editData.title}
              onChange={(e) => {
                if (e.target.value.length <= 20) {
                  setEditData({ ...editData, title: e.target.value });
                }
              }}
            />
            <p className="text-xs flex justify-end mt-2 text-gray-500">
              {editData.title.length}/20
            </p>

            <Label className="text-medium">
              Description <span className="text-gray-400">(optional)</span>
            </Label>
            <Textarea
              placeholder="Add a description"
              className="resize-none"
              value={editData.description}
              onChange={(e) => {
                if (e.target.value.length <= 50) {
                  setEditData({ ...editData, description: e.target.value });
                }
              }}
            />
            <p className="text-xs flex justify-end mt-2 text-gray-500">
              {editData.description.length}/50
            </p>

            <div className="space-y-2">
              <Label className="text-medium">
                Date and Time <span className="text-red-500">*</span>{" "}
                <span className="text-gray-400 text-xs">
                  no time will result into all-day event
                </span>
              </Label>
              <div className="space-y-1">
                <div className="flex gap-2">
                  <div>
                    <Popover
                      modal
                      open={openEditDatePicker}
                      onOpenChange={setOpenEditDatePicker}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-[195px] h-7 text-[11px] flex justify-between"
                        >
                          {editData.date
                            ? format(editData.date, "MMM d, yyyy")
                            : "Pick a date"}
                          <CalendarIcon className="ml-1 h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto p-0"
                        onOpenAutoFocus={(e: Event) => e.preventDefault()}
                      >
                        <Calendar
                          mode="single"
                          selected={editData.date || undefined}
                          onSelect={(date: Date | undefined) => {
                            if (date) {
                              setEditData({ ...editData, date: date || null });
                            }
                          }}
                          disabled={(date: Date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="time"
                      value={editData.fromTime}
                      onChange={(e) => handleEditTimeChange(e, true)}
                      className="h-7 text-[11px]"
                      placeholder="Start"
                    />
                    <Input
                      type="time"
                      value={editData.toTime}
                      onChange={(e) => handleEditTimeChange(e, false)}
                      className="h-7 text-[11px]"
                      placeholder="End"
                    />
                  </div>
                </div>
              </div>
              {dateError && (
                <p className="text-[11px] text-red-500">{dateError}</p>
              )}
              {timeError && (
                <p className="text-[11px] text-red-500">{timeError}</p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setOpenEdit(false)}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 h-8 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={saveEdit}
              className="bg-[#124A69] text-white hover:bg-[#0a2f42] h-8 text-xs"
              disabled={
                !editData.title || !editData.date || !!timeError || isSaving
              }
            >
              {isSaving ? "Saving..." : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openAdd}
        onOpenChange={(open) => {
          if (!open && (isSaving || alert.show || !hasAttemptedSave)) {
            return;
          }
          if (!open && hasUnsavedChanges) {
            setPendingAction("close");
            setOpenUnsavedChanges(true);
          } else {
            setOpenAdd(open);
            if (open) {
              setAlert({
                show: false,
                title: "",
                description: "",
                variant: "success",
              });
            }
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Event</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3">
            {alert.show && alert.variant === "error" && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  {alert.description}
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label className="text-medium">
                Title<span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Title"
                value={newEvent.title}
                onChange={(e) => {
                  if (e.target.value.length <= 20) {
                    setNewEvent({ ...newEvent, title: e.target.value });
                  }
                }}
              />
              <p className="text-[10px] flex justify-end mt-1 text-gray-500">
                {newEvent.title.length}/20
              </p>
            </div>
            <div>
              <Label className="text-medium">
                Description<span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add a description"
                className="resize-none h-16"
                value={newEvent.description}
                onChange={(e) => {
                  if (e.target.value.length <= 30) {
                    setNewEvent({ ...newEvent, description: e.target.value });
                  }
                }}
              />
              <p className="text-[10px] flex justify-end mt-1 text-gray-500">
                {newEvent.description.length}/30
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-medium">
                Date and Time <span className="text-red-500">*</span>{" "}
                <span className="text-gray-400 text-xs">
                  no time will result into all-day event
                </span>
              </Label>
              <div className="space-y-1">
                <div className="flex gap-2">
                  <div>
                    <Popover
                      modal
                      open={openAddDatePicker}
                      onOpenChange={setOpenAddDatePicker}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-[195px] h-7 text-[11px] flex justify-between"
                        >
                          {newEvent.date
                            ? format(newEvent.date, "MMM d, yyyy")
                            : "Pick a date"}
                          <CalendarIcon className="ml-1 h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto p-0"
                        onOpenAutoFocus={(e: Event) => e.preventDefault()}
                      >
                        <Calendar
                          mode="single"
                          selected={newEvent.date || undefined}
                          onSelect={(date: Date | undefined) => {
                            if (date) {
                              setNewEvent({
                                ...newEvent,
                                date: date || null,
                              });
                            }
                          }}
                          disabled={(date: Date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="time"
                      value={newEvent.fromTime}
                      onChange={(e) => handleTimeChange(e, true)}
                      className="h-7 text-[11px]"
                      placeholder="Start"
                    />
                    <Input
                      type="time"
                      value={newEvent.toTime}
                      onChange={(e) => handleTimeChange(e, false)}
                      className="h-7 text-[11px]"
                      placeholder="End"
                    />
                  </div>
                </div>
              </div>
              {dateError && (
                <p className="text-[11px] text-red-500">{dateError}</p>
              )}
              {timeError && (
                <p className="text-[11px] text-red-500">{timeError}</p>
              )}

              {/* Additional Dates Section */}
              {newEvent.dates.length > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-medium">Additional Dates</Label>
                    <span className="text-[10px] text-gray-500">
                      {newEvent.dates.length} additional{" "}
                      {newEvent.dates.length === 1 ? "date" : "dates"}
                    </span>
                  </div>
                  <div
                    className={`mt-1 space-y-2 ${
                      newEvent.dates.length > 4
                        ? "max-h-60 overflow-y-auto pr-1"
                        : ""
                    }`}
                  >
                    {newEvent.dates.map((dateItem, index) => (
                      <div key={index} className="flex gap-2">
                        <div>
                          <Popover
                            modal
                            open={openAdditionalDatePickers[index]}
                            onOpenChange={(open: boolean) => {
                              setOpenAdditionalDatePickers((prev) => {
                                const next = [...prev];
                                next[index] = open;
                                return next;
                              });
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-[195px] h-7 text-[11px] flex justify-between"
                              >
                                {dateItem.date
                                  ? format(dateItem.date, "MMM d, yyyy")
                                  : "Pick a date"}
                                <CalendarIcon className="ml-1 h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-auto p-0"
                              onOpenAutoFocus={(e: Event) => e.preventDefault()}
                            >
                              <Calendar
                                mode="single"
                                selected={dateItem.date || undefined}
                                onSelect={(date: Date | undefined) => {
                                  handleAdditionalDateChange(
                                    index,
                                    date || null
                                  );
                                }}
                                disabled={(date: Date) =>
                                  date <
                                  new Date(new Date().setHours(0, 0, 0, 0))
                                }
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="grid grid-cols-2 gap-1">
                            <div className="relative">
                              <Input
                                type="time"
                                value={dateItem.fromTime}
                                onChange={(e) =>
                                  handleAdditionalTimeChange(
                                    index,
                                    e.target.value,
                                    true
                                  )
                                }
                                className="h-7 text-[11px] cursor-pointer"
                                onClick={(e) => {
                                  const input = e.target as HTMLInputElement;
                                  if (typeof input.showPicker === "function") {
                                    input.showPicker();
                                  }
                                }}
                              />
                              {!dateItem.fromTime && (
                                <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-[11px] text-muted-foreground"></div>
                              )}
                            </div>
                            <div className="relative">
                              <Input
                                type="time"
                                value={dateItem.toTime}
                                onChange={(e) =>
                                  handleAdditionalTimeChange(
                                    index,
                                    e.target.value,
                                    false
                                  )
                                }
                                className="h-7 text-[11px] cursor-pointer"
                                onClick={(e) => {
                                  const input = e.target as HTMLInputElement;
                                  if (typeof input.showPicker === "function") {
                                    input.showPicker();
                                  }
                                }}
                              />
                              {!dateItem.toTime && (
                                <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-[11px] text-muted-foreground"></div>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => removeDate(index)}
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-red-50"
                            type="button"
                          >
                            <Trash className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Date Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 text-[11px] w-full"
                onClick={addNewDate}
              >
                <Plus className="mr-1 h-3 w-3" />
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setOpenAdd(false)}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 h-8 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={saveNewEvent}
              className="bg-[#124A69] text-white hover:bg-[#0a2f42] h-8 text-xs"
              disabled={
                !newEvent.title || !newEvent.date || !!timeError || isSaving
              }
            >
              {isSaving ? "Saving..." : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={openConfirmSave} onOpenChange={setOpenConfirmSave}>
        <AlertDialogContent className="max-h-[80vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Event Details</AlertDialogTitle>
            <AlertDialogDescription>
              Please review the event details before saving:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#124A69] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0a2f42]">
            {eventsToSave && (
              <div className="space-y-4">
                {/* Title and Description Section */}
                <div className="space-y-2 border-b pb-4">
                  <div>
                    <div className="font-medium text-sm text-gray-500 mb-1">
                      Title
                    </div>
                    <div className="text-[#124A69] font-medium">
                      {eventsToSave.data.title}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-500 mb-1">
                      Description
                    </div>
                    <div className="text-gray-600">
                      {eventsToSave.data.description || "No description"}
                    </div>
                  </div>
                </div>

                {/* Dates Section */}
                <div className="space-y-3">
                  <div className="font-medium text-sm text-gray-500">
                    {eventsToSave.type === "new" &&
                    eventsToSave.data.dates.length > 0
                      ? "Schedules"
                      : "Schedule"}
                  </div>

                  <div
                    className={`space-y-1.5 ${
                      eventsToSave.type === "new" &&
                      eventsToSave.data.dates.length > 6
                        ? "max-h-[300px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#124A69] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0a2f42]"
                        : ""
                    }`}
                  >
                    {/* Main Date */}
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">Date:</span>
                          <span className="font-medium">
                            {eventsToSave.data.date
                              ? format(eventsToSave.data.date, "MMMM d, yyyy")
                              : "----"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">Time:</span>
                          <span className="font-medium">
                            {eventsToSave.data.fromTime &&
                            eventsToSave.data.toTime
                              ? `${formatTimeTo12Hour(
                                  eventsToSave.data.fromTime
                                )} - ${formatTimeTo12Hour(
                                  eventsToSave.data.toTime
                                )}`
                              : "----"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Additional Dates */}
                    {eventsToSave.type === "new" &&
                      eventsToSave.data.dates.length > 0 && (
                        <>
                          {eventsToSave.data.dates.map((date, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 rounded-lg p-2"
                            >
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">Date:</span>
                                  <span className="font-medium">
                                    {date.date
                                      ? format(date.date, "MMMM d, yyyy")
                                      : "----"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">Time:</span>
                                  <span className="font-medium">
                                    {date.fromTime && date.toTime
                                      ? `${formatTimeTo12Hour(
                                          date.fromTime
                                        )} - ${formatTimeTo12Hour(date.toTime)}`
                                      : "----"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              onClick={() => {
                setOpenConfirmSave(false);
                setEventsToSave(null);
              }}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 h-8 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSave}
              className="bg-[#124A69] text-white hover:bg-[#0a2f42] h-8 text-xs"
              disabled={
                isSaving ||
                (eventsToSave ? hasIncompleteDates(eventsToSave.data) : true)
              }
            >
              {isSaving ? "Saving..." : "Confirm & Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openUnsavedChanges}
        onOpenChange={setOpenUnsavedChanges}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your event form. Would you like to
              keep these changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => handleUnsavedChangesResponse(false)}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 h-8 text-xs"
            >
              Discard Changes
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleUnsavedChangesResponse(true)}
              className="bg-[#124A69] text-white hover:bg-[#0a2f42] h-8 text-xs"
            >
              Keep Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
