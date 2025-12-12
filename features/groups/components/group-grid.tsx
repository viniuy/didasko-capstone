import React, { useState } from "react";
import { GroupCard } from "./group-card";
import { AddGroupModal } from "./add-group-modal";
import { WheelRandomizer } from "./randomizer-button";
import { Loader2 } from "lucide-react";
import { Group } from "@/shared/types/groups";
import { AttendanceStatus } from "@prisma/client";
// Note: selection controls are lifted to parent; delete handled by parent
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
  // selection props lifted to parent
  selectionMode?: boolean;
  selectedGroupIds?: string[];
  toggleSelectGroup?: (groupId: string) => void;
  deleteSelected?: () => void;
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
  selectionMode = false,
  selectedGroupIds = [],
  toggleSelectGroup,
  deleteSelected,
}: GroupGridProps) {
  // selection mode state
  const [currentPage, setCurrentPage] = useState(1);
  const [redirectingGroupId, setRedirectingGroupId] = useState<string | null>(
    null
  );
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    // Initialize with correct value based on current window width
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      if (width >= 1280) return 4;
      if (width >= 1024) return 3;
    }
    return 2;
  });

  // Calculate ungrouped students count first
  const ungroupedStudentCount = totalStudents - excludedStudentIds.length;

  // Adjust items per page based on screen size
  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1280) {
        // xl breakpoint
        setItemsPerPage(4);
      } else if (width >= 1024) {
        // lg breakpoint
        setItemsPerPage(3);
      } else {
        // mobile/tablet
        setItemsPerPage(2);
      }
    };

    // Set initial value
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // Calculate total pages
  const shouldShowAddButton = !hasSearchQuery && ungroupedStudentCount > 0;
  const basePages = Math.ceil(groups.length / itemsPerPage);
  // Only add extra page if the last page is full
  const isLastPageFull =
    groups.length % itemsPerPage === 0 && groups.length > 0;
  const totalPages =
    shouldShowAddButton && isLastPageFull ? basePages + 1 : basePages || 1;

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
          nextGroupNumber={nextGroupNumber}
        />
      </div>
    );
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Sort groups by numeric `number` when possible so grid is ordered by group number
  const sortedGroups = [...groups].sort((a, b) => {
    const na = Number(a.number);
    const nb = Number(b.number);
    const aIsNum = !isNaN(na);
    const bIsNum = !isNaN(nb);

    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return (a.number ?? "").localeCompare(b.number ?? "");
  });

  const currentGroups = sortedGroups.slice(startIndex, endIndex);

  // Show add button on current page if:
  // 1. We should show add button (ungrouped students exist)
  // 2. We're on the last page
  // 3. There's space available (current groups < itemsPerPage)
  const showAddButtonOnCurrentPage =
    shouldShowAddButton &&
    currentPage === totalPages &&
    currentGroups.length < itemsPerPage;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 px-2 sm:px-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 3xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 items-start justify-center">
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
            showSelect={selectionMode}
            isSelected={selectedGroupIds.includes(group.id)}
            onToggleSelect={(id: string) => toggleSelectGroup?.(id)}
          />
        ))}
        {showAddButtonOnCurrentPage && (
          <div className="flex flex-col gap-4 items-center justify-center min-h-[300px]">
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
                nextGroupNumber={nextGroupNumber}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end w-full mt-3 sm:mt-4 -mb-3 gap-3 sm:gap-4">
        <span className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1 w-100 text-center sm:text-left">
          Showing {startIndex + 1}-{Math.min(endIndex, groups.length)} of{" "}
          {groups.length} groups
        </span>
        <Pagination className="order-1 sm:order-2 justify-end">
          <PaginationContent className="flex-wrap justify-center gap-0.5 text-xs sm:text-sm">
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
            {(() => {
              // Show only 3 pages maximum: first, current (if in middle), and last
              const pages: (number | string)[] = [];

              if (totalPages <= 3) {
                // Show all pages if 3 or less
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(i);
                }
              } else if (currentPage <= 2) {
                // At the beginning: 1 2 … last
                pages.push(1, 2, "…", totalPages);
              } else if (currentPage >= totalPages - 1) {
                // At the end: 1 … second-to-last last
                pages.push(1, "…", totalPages - 1, totalPages);
              } else {
                // In the middle: 1 … current … last
                pages.push(1, "…", currentPage, "…", totalPages);
              }

              return pages;
            })().map((item, i) => (
              <PaginationItem key={i}>
                {item === "…" ? (
                  <span className="px-2 text-gray-500 select-none text-xs sm:text-sm">
                    …
                  </span>
                ) : (
                  <PaginationLink
                    onClick={() => setCurrentPage(item as number)}
                    isActive={currentPage === item}
                    className={
                      currentPage === item
                        ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                        : ""
                    }
                  >
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
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
