"use client";
import React, { useState } from "react";
import FacultyList from "./faculty-list";
import WeeklySchedule from "@/features/dashboard/components/weekly-schedule";
import FacultyDetails from "./faculty-details";
import { Role, WorkType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEPARTMENTS } from "@/lib/constants/departments";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  semester: string;
  schedules: {
    id: string;
    day: Date;
    fromTime: string;
    toTime: string;
  }[];
  students: {
    id: string;
  }[];
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  image: string | null;
  department: string;
  workType: WorkType;
  role: Role;
  roles: Role[];
  coursesTeaching: Course[];
}

export default function FacultyLoad() {
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<string[]>([]);
  const [tempSortOption, setTempSortOption] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const itemsPerPage = 15;

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleDepartmentClick = (department: string) => {
    setTempSortOption((prev) =>
      prev.includes(department)
        ? prev.filter((d) => d !== department)
        : [...prev, department]
    );
  };

  const handleFilterOpen = (open: boolean) => {
    if (open) {
      // When opening, initialize temp state with current filter
      setTempSortOption([...sortOption]);
    } else {
      // When closing without applying, revert to current filter
      setTempSortOption([...sortOption]);
    }
    setIsFilterOpen(open);
  };

  const handleApplyFilter = () => {
    setSortOption([...tempSortOption]);
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const handleClearFilter = () => {
    setTempSortOption([]);
  };

  const handleCancelFilter = () => {
    // Revert to previous state
    setTempSortOption([...sortOption]);
    setIsFilterOpen(false);
  };

  const handleTeacherClick = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
  };

  const handleBack = () => {
    setIsNavigatingBack(true);
    setTimeout(() => {
      setSelectedTeacher(null);
      setIsNavigatingBack(false);
    }, 200);
  };

  // Department options
  const departmentOptions = DEPARTMENTS.map((dept) => ({
    value: dept,
    label: dept,
  }));

  return (
    <div className="h-full flex flex-col min-h-[600px] max-h-screen overflow-y-auto sm:max-h-full">
      {/* Search and Filter Bar */}
      {!selectedTeacher && (
        <div className="bg-white rounded-lg shadow-md flex-shrink-0">
          <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b">
            {/* Title */}
            <div className="flex flex-col mr-2">
              <span className="text-base sm:text-lg font-bold text-[#124A69] leading-tight">
                Faculty Load
              </span>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-80">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-2 top-2.5 h-4 w-4 text-gray-500"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#124A69]/20 focus:border-[#124A69] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  &#10005;
                </button>
              )}
            </div>

            {/* Filter button */}
            <Button
              variant="outline"
              className="rounded-full relative flex items-center gap-2 px-2 lg:px-3 h-9 bg-white text-[#124A69] hover:bg-gray-100 border border-gray-200 flex-shrink-0 ml-auto"
              onClick={() => handleFilterOpen(true)}
            >
              <Filter className="h-4 w-4" />
              <span className="text-sm hidden lg:inline">Filter</span>
              {sortOption.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {sortOption.length}
                </span>
              )}
            </Button>
          </div>

          <Sheet open={isFilterOpen} onOpenChange={handleFilterOpen}>
            <SheetContent side="right" className="w-[340px] sm:w-[400px] p-0">
              <div className="p-6 border-b">
                <SheetHeader>
                  <SheetTitle className="text-xl font-semibold">
                    Filter Options
                  </SheetTitle>
                </SheetHeader>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <div className="space-y-3 border rounded-lg p-4 bg-white">
                    {departmentOptions.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={tempSortOption.includes(option.value)}
                          onCheckedChange={() =>
                            handleDepartmentClick(option.value)
                          }
                          className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] data-[state=checked]:text-white"
                        />
                        <span className="text-sm text-gray-700">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-6 border-t mt-auto">
                <Button
                  variant="outline"
                  className="flex-1 rounded-lg"
                  onClick={handleCancelFilter}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-lg"
                  onClick={handleClearFilter}
                >
                  Clear
                </Button>
                <Button
                  className="flex-1 rounded-lg bg-[#124A69] hover:bg-[#0D3A54] text-white"
                  onClick={handleApplyFilter}
                >
                  Apply
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 gap-4 mb-4">
          {selectedTeacher ? (
            <div
              className={`transition-opacity duration-200 ${
                isNavigatingBack ? "opacity-0" : "opacity-100"
              }`}
            >
              <FacultyDetails faculty={selectedTeacher} onBack={handleBack} />
              <WeeklySchedule
                teacherInfo={selectedTeacher}
                isViewingOtherTeacher={true}
              />
            </div>
          ) : (
            <FacultyList
              search={search}
              sortOption={sortOption}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onDepartmentClick={handleDepartmentClick}
              onTeacherClick={handleTeacherClick}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
