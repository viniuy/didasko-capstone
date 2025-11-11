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
}: GroupGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil((groups.length + 1) / itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-row gap-12 items-center justify-center mb-8">
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
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start justify-center min-h-[610px] max-h-[610px]">
        {currentGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            courseCode={courseCode}
            courseSection={courseSection}
            onGroupDeleted={onGroupAdded}
          />
        ))}
        {currentPage === totalPages && (
          <div className="flex flex-col gap-2 ml-9 mt-3">
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
            {/* <RandomizerButton disabled /> */}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end w-full mt-4 -mb-3 gap-4">
        <span className="text-sm text-gray-600 w-1700">
          Showing {startIndex + 1}-{Math.min(endIndex, groups.length)} of{" "}
          {groups.length} groups
        </span>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i}>
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