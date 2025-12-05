"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Users, Search } from "lucide-react";
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
  disabled?: boolean;
  userRoles?: string[];
}

export function FacultyFilter({
  faculties,
  selectedFacultyIds,
  onChange,
  currentUserId,
  disabled = false,
  userRoles = [],
}: FacultyFilterProps) {
  const { data: session } = useSession();
  const currentUser = session?.user;
  const [searchQuery, setSearchQuery] = useState("");

  // Detect if user is pure Academic Head (ACADEMIC_HEAD role without FACULTY role)
  const isPureAcademicHead =
    userRoles.includes("ACADEMIC_HEAD") && !userRoles.includes("FACULTY");

  // Get the selected faculty ID (should be single selection)
  const selectedFacultyId =
    selectedFacultyIds.length > 0 ? selectedFacultyIds[0] : "";

  const handleSelectFaculty = (facultyId: string) => {
    // Radio button behavior: always set to the selected faculty
    onChange([facultyId]);
  };

  const getDisplayText = () => {
    if (!selectedFacultyId) {
      return "No faculty selected";
    }
    // For pure Academic Head, don't show "My Courses"
    if (!isPureAcademicHead && selectedFacultyId === currentUserId) {
      return `My Courses${currentUser?.name ? ` (${currentUser.name})` : ""}`;
    }
    const faculty = faculties.find((f) => f.id === selectedFacultyId);
    return faculty?.name || "Selected faculty";
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
  // Don't show "My Courses" for pure Academic Head
  const shouldShowMyCourses =
    !isPureAcademicHead &&
    (!searchQuery ||
      (currentUser?.name &&
        currentUser.name.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Users className="w-4 h-4" />
        <span>Filter by Faculty:</span>
      </div>
      <div
        className={`border rounded-md p-3 bg-gray-50 ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
      >
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
            disabled={disabled}
          />
        </div>
        <div className="h-[200px] overflow-y-auto pr-4">
          <div className="space-y-2">
            {/* My Courses option */}
            {shouldShowMyCourses && (
              <div className="flex items-center space-x-2 p-2 rounded hover:bg-white transition-colors group">
                <label
                  htmlFor={`faculty-${currentUserId}`}
                  className={`flex items-center ${
                    disabled ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="radio"
                    id={`faculty-${currentUserId}`}
                    name="faculty-filter"
                    checked={selectedFacultyId === currentUserId}
                    onChange={() => handleSelectFaculty(currentUserId)}
                    className="sr-only peer"
                    disabled={disabled}
                  />
                  <div
                    className={`relative w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center group-hover:border-[#124A69]/60 peer-focus-visible:ring-2 peer-focus-visible:ring-[#124A69]/50 peer-focus-visible:ring-offset-2 peer-focus-visible:outline-none ${
                      selectedFacultyId === currentUserId
                        ? "border-[#124A69]"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedFacultyId === currentUserId && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#124A69] transition-all duration-200"></div>
                    )}
                  </div>
                </label>
                <label
                  htmlFor={`faculty-${currentUserId}`}
                  className={`text-sm font-medium flex-1 ${
                    disabled ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
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
                  className="flex items-center space-x-2 p-2 rounded hover:bg-white transition-colors group"
                >
                  <label
                    htmlFor={`faculty-${faculty.id}`}
                    className={`flex items-center ${
                      disabled ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      id={`faculty-${faculty.id}`}
                      name="faculty-filter"
                      checked={selectedFacultyId === faculty.id}
                      onChange={() => handleSelectFaculty(faculty.id)}
                      className="sr-only peer"
                      disabled={disabled}
                    />
                    <div
                      className={`relative w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center group-hover:border-[#124A69]/60 peer-focus-visible:ring-2 peer-focus-visible:ring-[#124A69]/50 peer-focus-visible:ring-offset-2 peer-focus-visible:outline-none ${
                        selectedFacultyId === faculty.id
                          ? "border-[#124A69]"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedFacultyId === faculty.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#124A69] transition-all duration-200"></div>
                      )}
                    </div>
                  </label>
                  <label
                    htmlFor={`faculty-${faculty.id}`}
                    className={`text-sm flex-1 ${
                      disabled ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
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
