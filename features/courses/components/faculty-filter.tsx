"use client";
import React from "react";
import { useSession } from "next-auth/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

interface Faculty {
  id: string;
  name: string;
  email: string;
  department?: string;
}

interface FacultyFilterProps {
  faculties: Faculty[];
  selectedFacultyId: string;
  onChange: (facultyId: string) => void;
  currentUserId: string;
}

export function FacultyFilter({
  faculties,
  selectedFacultyId,
  onChange,
  currentUserId,
}: FacultyFilterProps) {
  const { data: session } = useSession();
  const currentUser = session?.user;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Users className="w-4 h-4" />
        <span>Filter by Faculty:</span>
      </div>
      <Select value={selectedFacultyId} onValueChange={onChange}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select faculty">
            {selectedFacultyId === "ALL"
              ? "All Faculties"
              : selectedFacultyId === currentUserId
              ? `My Courses${currentUser?.name ? ` (${currentUser.name})` : ""}`
              : faculties.find((f) => f.id === selectedFacultyId)?.name ||
                "Select faculty"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={currentUserId}>
            <span className="font-medium">My Courses</span>
            {currentUser?.name && (
              <span className="text-xs text-gray-500 ml-2">
                ({currentUser.name})
              </span>
            )}
          </SelectItem>
          <SelectItem value="ALL">
            <span className="font-medium">All Faculties</span>
          </SelectItem>
          <div className="border-t my-1" />
          {faculties
            .filter((f) => f.id !== currentUserId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((faculty) => (
              <SelectItem key={faculty.id} value={faculty.id}>
                {faculty.name}
                {faculty.department && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({faculty.department})
                  </span>
                )}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
