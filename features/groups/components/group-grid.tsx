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

  // Calculate ungrouped students count first
  const ungroupedStudentCount = totalStudents - excludedStudentIds.length;

  const itemsPerPage = 2;
  // Calculate total pages: if we have ungrouped students and no search query, add 1 for the add button page
  const shouldShowAddButton = !hasSearchQuery && ungroupedStudentCount > 0;
  const totalPages = shouldShowAddButton
    ? Math.ceil(groups.length / itemsPerPage) + 1
    : Math.ceil(groups.length / itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

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

  // Check if current page should show the add button
  const isAddButtonPage =
    shouldShowAddButton &&
    currentPage === totalPages &&
    currentGroups.length === 0;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 px-2 sm:px-4">
      {isAddButtonPage ? (
        // Show only add button and randomizer on dedicated page
        <div className="flex flex-col gap-6 items-center justify-center min-h-[300px]">
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
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 items-start justify-center">
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
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end w-full mt-3 sm:mt-4 -mb-3 gap-3 sm:gap-4">
        <span className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1 w-full text-center sm:text-left">
          Showing {startIndex + 1}-{Math.min(endIndex, groups.length)} of{" "}
          {groups.length} groups
        </span>
        <Pagination className="order-1 sm:order-2 justify-end">
          <PaginationContent className="flex-wrap justify-center gap-1">
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i} className="hidden md:inline-block">
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
            {/* Mobile/Tablet: Show only current page number */}
            <PaginationItem className="md:hidden">
              <span className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
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
