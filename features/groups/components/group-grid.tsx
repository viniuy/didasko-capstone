import React, { useState } from "react";
import { GroupCard } from "./group-card";
import { AddGroupModal } from "./add-group-modal";
import { WheelRandomizer } from "./randomizer-button";
import { Loader2 } from "lucide-react";
import { Group } from "@/shared/types/groups";
import { AttendanceStatus } from "@prisma/client";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Student {
  id: string;
  name: string;
  status: AttendanceStatus | "NOT_SET";
}

interface GroupMeta {
  names: string[];
  numbers: number[];
  usedNames: string[];
  usedNumbers: number[];
}

interface GroupGridProps {
  groups: Group[];
  isLoading: boolean;
  courseCode: string;
  courseSection: string;
  excludedStudentIds: string[];
  nextGroupNumber: number;
  onGroupAdded: () => void;
  students: Student[];
  groupMeta: GroupMeta;
  totalStudents: number;
  hasSearchQuery?: boolean;
}

export function GroupGrid({
  groups,
  isLoading,
  courseCode,
  courseSection,
  excludedStudentIds,
  nextGroupNumber,
  onGroupAdded,
  students,
  groupMeta,
  totalStudents,
  hasSearchQuery = false,
}: GroupGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [redirectingGroupId, setRedirectingGroupId] = useState<string | null>(
    null
  );
  const itemsPerPage = 4;
  const totalPages = Math.ceil((groups.length + 1) / itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Calculate ungrouped students count
  const ungroupedStudentCount = totalStudents - excludedStudentIds.length;

  if (groups.length === 0) {
    // Don't show add group and randomizer buttons if there's a search query
    if (hasSearchQuery) {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-gray-500 text-center">
            No groups found matching your search
          </p>
        </div>
      );
    }

    // Don't show add group and randomizer buttons if there are no ungrouped students
    if (ungroupedStudentCount <= 0) {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-gray-500 text-center">
            All students are already in groups
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 items-center justify-center mb-8 px-4">
        <AddGroupModal
          courseCode={courseCode}
          excludedStudentIds={excludedStudentIds}
          nextGroupNumber={nextGroupNumber}
          onGroupAdded={onGroupAdded}
          isValidationNeeded={false}
          totalStudents={totalStudents}
          students={students}
          groupMeta={groupMeta}
        />
        <WheelRandomizer
          students={students}
          excludedStudentIds={excludedStudentIds}
          courseCode={courseCode}
          onGroupsCreated={onGroupAdded}
        />
      </div>
    );
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGroups = groups.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col gap-8 px-2 sm:px-4">
      <div className="grid grid-cols-4 gap-3 sm:gap-4 items-start justify-center">
        {currentGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            courseCode={courseCode}
            courseSection={courseSection}
            onGroupDeleted={onGroupAdded}
            isRedirecting={redirectingGroupId === group.id}
            isDisabled={
              redirectingGroupId !== null && redirectingGroupId !== group.id
            }
            onNavigate={() => setRedirectingGroupId(group.id)}
          />
        ))}
        {currentPage === totalPages &&
          !hasSearchQuery &&
          ungroupedStudentCount > 0 && (
            <div className="flex flex-col gap-2 sm:gap-6 items-center justify-center sm:ml-9 mt-3">
              <AddGroupModal
                courseCode={courseCode}
                excludedStudentIds={excludedStudentIds}
                nextGroupNumber={nextGroupNumber}
                onGroupAdded={onGroupAdded}
                isValidationNeeded={false}
                totalStudents={totalStudents}
                students={students}
                groupMeta={groupMeta}
              />
              {ungroupedStudentCount > 4 && (
                <WheelRandomizer
                  students={students}
                  excludedStudentIds={excludedStudentIds}
                  courseCode={courseCode}
                  onGroupsCreated={onGroupAdded}
                />
              )}
            </div>
          )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end w-full mt-4 -mb-3 gap-4">
        <span className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1 w-full">
          Showing {startIndex + 1}-{Math.min(endIndex, groups.length)} of{" "}
          {groups.length} groups
        </span>
        <Pagination className="order-1 sm:order-2 justify-end">
          <PaginationContent className="flex-wrap justify-center">
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i} className="hidden sm:inline-block">
                <PaginationLink
                  isActive={currentPage === i + 1}
                  onClick={() => setCurrentPage(i + 1)}
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
            {/* Mobile: Show only current page number */}
            <PaginationItem className="sm:hidden">
              <span className="px-3 py-2 text-sm">
                {currentPage} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
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
}
