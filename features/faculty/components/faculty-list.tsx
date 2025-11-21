"use client";
import React, { useEffect, useState } from "react";
import { Role, WorkType } from "@prisma/client";
import { UserCircle2 } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

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

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  image: string | null;
  role: Role;
  coursesTeaching: Course[];
}

interface FacultyListProps {
  search: string;
  sortOption: string[];
  currentPage: number;
  itemsPerPage: number;
  onDepartmentClick: (department: string) => void;
  onTeacherClick: (teacher: FacultyMember) => void;
  onPageChange: (page: number) => void;
}

const FacultyList: React.FC<FacultyListProps> = ({
  search,
  sortOption,
  currentPage,
  itemsPerPage: rawItemsPerPage,
  onDepartmentClick,
  onTeacherClick,
  onPageChange,
}) => {
  // Ensure itemsPerPage is capped at 10
  const itemsPerPage = Math.min(rawItemsPerPage, 10);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        const response = await fetch("/api/users/faculty");
        if (!response.ok) {
          throw new Error("Failed to fetch faculty");
        }
        const data = await response.json();
        setFaculty(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch faculty"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchFaculty();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#124A69]"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error: {error}</div>;
  }

  const filteredFaculty = faculty
    .filter((faculty) =>
      faculty.name.toLowerCase().includes(search.toLowerCase())
    )
    .filter((faculty) =>
      sortOption.length > 0 ? sortOption.includes(faculty.department) : true
    );

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFaculty = filteredFaculty.slice(startIndex, endIndex);
  const totalItems = filteredFaculty.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleViewSchedule = (faculty: FacultyMember) => {
    setIsNavigating(true);
    setTimeout(() => {
      onTeacherClick(faculty);
    }, 200);
  };

  return (
    <div
      className={`flex flex-col gap-8 min-h-[600px] transition-opacity duration-200 ${
        isNavigating ? "opacity-0" : "opacity-100"
      }`}
    >
      {filteredFaculty.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500 min-h-[610px] max-h-[610px]">
          <UserCircle2 size={72} className="mb-6 text-gray-400" />
          <p className="text-2xl font-medium mb-2">No teachers found</p>
          <p className="text-base text-gray-400">
            {search
              ? "Try adjusting your search"
              : "No teachers in this department"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start justify-center min-h-[610px] max-h-[610px]">
            {currentFaculty.map((faculty) => (
              <div
                key={faculty.id}
                className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow mt-5 h-fit"
              >
                <div className="flex flex-col items-center space-y-4">
                  {/* Profile Picture */}
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-[#124A69] flex items-center justify-center text-white">
                    {faculty.image ? (
                      <img
                        src={faculty.image}
                        alt={faculty.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-semibold">
                        {faculty.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-lg font-semibold text-gray-900 text-center">
                    {faculty.name}
                  </h3>

                  {/* Department */}
                  <p
                    className="text-sm text-[#124A69] hover:underline cursor-pointer text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDepartmentClick(faculty.department);
                    }}
                  >
                    {faculty.department}
                  </p>

                  {/* View Schedule Button */}
                  <button
                    onClick={() => handleViewSchedule(faculty)}
                    className="w-full bg-[#124A69] text-white px-4 py-2 rounded-full hover:bg-[#0D3A54] transition-colors text-sm font-medium"
                  >
                    View Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-end w-full mt-4 -mb-3 gap-4">
        <span className="text-sm text-gray-600 w-1700">
          {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}{" "}
          faculty members
        </span>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(currentPage - 1)}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  isActive={currentPage === i + 1}
                  onClick={() => onPageChange(i + 1)}
                  className={
                    currentPage === i + 1
                      ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                      : ""
                  }
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(currentPage + 1)}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
};

export default FacultyList;
