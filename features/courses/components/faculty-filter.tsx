"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Users, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Faculty {
  id: string;
  name: string;
  email: string;
  department?: string;
}

interface FacultyFilterProps {
  faculties: Faculty[];
  selectedFacultyIds: string[];
  onChange: (facultyIds: string[]) => void;
  currentUserId: string;
}

export function FacultyFilter({
  faculties,
  selectedFacultyIds,
  onChange,
  currentUserId,
}: FacultyFilterProps) {
  const { data: session } = useSession();
  const currentUser = session?.user;
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggleFaculty = (facultyId: string) => {
    if (selectedFacultyIds.includes(facultyId)) {
      onChange(selectedFacultyIds.filter((id) => id !== facultyId));
    } else {
      onChange([...selectedFacultyIds, facultyId]);
    }
  };

  const handleSelectAll = () => {
    const allFacultyIds = [currentUserId, ...faculties.map((f) => f.id)];
    if (selectedFacultyIds.length === allFacultyIds.length) {
      onChange([]);
    } else {
      onChange(allFacultyIds);
    }
  };

  const getDisplayText = () => {
    if (selectedFacultyIds.length === 0) {
      return "No faculty selected";
    }
    if (selectedFacultyIds.length === 1) {
      const id = selectedFacultyIds[0];
      if (id === currentUserId) {
        return `My Courses${currentUser?.name ? ` (${currentUser.name})` : ""}`;
      }
      const faculty = faculties.find((f) => f.id === id);
      return faculty?.name || "Selected faculty";
    }
    return `${selectedFacultyIds.length} faculty selected`;
  };

  // Filter faculties based on search query
  const filteredFaculties = faculties.filter((faculty) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      faculty.name.toLowerCase().includes(query) ||
      faculty.email.toLowerCase().includes(query) ||
      (faculty.department && faculty.department.toLowerCase().includes(query))
    );
  });

  // Check if "My Courses" should be shown based on search
  const shouldShowMyCourses =
    !searchQuery ||
    (currentUser?.name &&
      currentUser.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Users className="w-4 h-4" />
          <span>Filter by Faculty:</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="h-7 text-xs"
        >
          {selectedFacultyIds.length ===
          [currentUserId, ...faculties.map((f) => f.id)].length
            ? "Deselect All"
            : "Select All"}
        </Button>
      </div>
      <div className="border rounded-md p-3 bg-gray-50">
        <div className="text-sm text-gray-600 mb-2 min-h-[20px]">
          {getDisplayText()}
        </div>
        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search faculty by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="h-[200px] overflow-y-auto pr-4">
          <div className="space-y-2">
            {/* My Courses option */}
            {shouldShowMyCourses && (
              <div className="flex items-center space-x-2 p-2 rounded hover:bg-white transition-colors">
                <Checkbox
                  id={`faculty-${currentUserId}`}
                  checked={selectedFacultyIds.includes(currentUserId)}
                  onCheckedChange={() => handleToggleFaculty(currentUserId)}
                  className="data-[state=checked]:bg-[#124A69] data-[state=checked]:text-white data-[state=checked]:border-[#124A69]"
                />
                <label
                  htmlFor={`faculty-${currentUserId}`}
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  My Courses
                  {currentUser?.name && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({currentUser.name})
                    </span>
                  )}
                </label>
              </div>
            )}

            {/* Other faculties */}
            {filteredFaculties
              .filter((f) => f.id !== currentUserId)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((faculty) => (
                <div
                  key={faculty.id}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-white transition-colors"
                >
                  <Checkbox
                    id={`faculty-${faculty.id}`}
                    checked={selectedFacultyIds.includes(faculty.id)}
                    onCheckedChange={() => handleToggleFaculty(faculty.id)}
                    className="data-[state=checked]:bg-[#124A69] data-[state=checked]:text-white data-[state=checked]:border-[#124A69]"
                  />
                  <label
                    htmlFor={`faculty-${faculty.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {faculty.name}
                    {faculty.department && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({faculty.department})
                      </span>
                    )}
                  </label>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
