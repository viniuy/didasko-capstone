"use client";
import React, { useState } from "react";
import FacultyList from "./faculty-list";
import WeeklySchedule from "@/features/dashboard/components/weekly-schedule";
import FacultyDetails from "./faculty-details";
import { Role, WorkType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  coursesTeaching: Course[];
}

export default function FacultyLoad() {
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const itemsPerPage = 15;

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleDepartmentClick = (department: string) => {
    setSortOption((prev) =>
      prev.includes(department)
        ? prev.filter((d) => d !== department)
        : [...prev, department]
    );
    setCurrentPage(1);
  };

  const handleTeacherClick = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
  };

  const handleBack = () => {
    setSelectedTeacher(null);
  };

  // Department options
  const departmentOptions = [
    { value: "IT Department", label: "IT Department" },
    { value: "BA Department", label: "BA Department" },
    { value: "TM Department", label: "TM Department" },
    { value: "HM Department", label: "HM Department" },
  ];

  return (
    <div className="h-full flex flex-col min-h-[600px]">
      {/* Search and Filter Bar */}
      {!selectedTeacher && (
        <div className="bg-[#124A69] text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white text-black px-4 py-2 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 w-64 "
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
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="rounded-full relative flex items-center gap-2 px-3 bg-white text-[#124A69] hover:bg-gray-100 border border-gray-200"
                onClick={() => setIsFilterOpen(true)}
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {sortOption.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {sortOption.length}
                  </span>
                )}
              </Button>
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetContent
                  side="right"
                  className="w-[340px] sm:w-[400px] p-0"
                >
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
                            <input
                              type="checkbox"
                              name="department-filter"
                              checked={sortOption.includes(option.value)}
                              onChange={() =>
                                handleDepartmentClick(option.value)
                              }
                              className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
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
                      onClick={() => {
                        setSortOption([]);
                        setIsFilterOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className="flex-1 rounded-lg bg-[#124A69] hover:bg-[#0D3A54] text-white"
                      onClick={() => setIsFilterOpen(false)}
                    >
                      Apply
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      )}
      {/* Main Content Area */}
      <div className="flex-grow ">
        <div className="grid grid-cols-1 gap-4 mb-4">
          {selectedTeacher ? (
            <div>
              <FacultyDetails faculty={selectedTeacher} onBack={handleBack} />
              <WeeklySchedule teacherInfo={selectedTeacher} />
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
