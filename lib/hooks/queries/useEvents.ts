"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { queryKeys } from "./queryKeys";
import toast from "react-hot-toast";

// Query: Get all events
export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events.lists(),
    queryFn: async () => {
      // Note: Adjust endpoint based on your actual API route
      const { data } = await axios.get("/events");
      return data;
    },
  });
}

// Query: Get events by role
export function useEventsByRole(role: string) {
  return useQuery({
    queryKey: queryKeys.events.byRole(role),
    queryFn: async () => {
      const { data } = await axios.get(`/events?role=${role}`);
      return data;
    },
    enabled: !!role,
  });
}

// Mutation: Create event
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: any) => {
      const { data } = await axios.post("/events", eventData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
      toast.success("Event created successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to create event");
    },
  });
}

// Mutation: Update event
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await axios.put(`/events/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
      toast.success("Event updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update event");
    },
  });
}

// Mutation: Delete event
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/events/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
      toast.success("Event deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete event");
    },
  });
}
