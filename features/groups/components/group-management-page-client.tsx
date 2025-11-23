"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { format } from "date-fns";
import { GroupHeader } from "@/features/groups/components/group-header";
import { GroupGrid } from "@/features/groups/components/group-grid";
import type { GroupMeta, Group, Course } from "@/features/groups/types";
import { groupsService } from "@/lib/services/client";
import { AttendanceStatus } from "@prisma/client";

interface Student {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  image?: string;
  status: AttendanceStatus | "NOT_SET";
}

interface GroupManagementPageClientProps {
  course: Course;
  initialGroups: Group[];
  initialStudents: Student[];
  initialGroupMeta: GroupMeta;
  courseSlug: string;
}

export function GroupManagementPageClient({
  course,
  initialGroups,
  initialStudents,
  initialGroupMeta,
  courseSlug,
}: GroupManagementPageClientProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [groupMeta, setGroupMeta] = useState<GroupMeta>(initialGroupMeta);

  // Filter groups based on search query
  const filteredGroups = groups.filter((group) => {
    const search = searchQuery.toLowerCase();
    return (
      group.number.toLowerCase().includes(search) ||
      (group.name && group.name.toLowerCase().includes(search)) ||
      group.students.some(
        (student) =>
          student.firstName.toLowerCase().includes(search) ||
          student.lastName.toLowerCase().includes(search)
      )
    );
  });

  // Compute all student IDs already in a group
  const excludedStudentIds = groups.flatMap((g) => g.students.map((s) => s.id));

  // Compute next group number (max + 1)
  const maxGroupNumber =
    groups.length > 0
      ? Math.max(...groups.map((g) => Number(g.number) || 0))
      : 0;
  const nextGroupNumber = maxGroupNumber + 1;

  // Function to refresh all data after adding/deleting groups
  const refreshData = async () => {
    try {
      setIsLoading(true);

      // Fetch all data using batched service
      const { groups, students, meta } =
        await groupsService.getCourseWithGroupsData(courseSlug);

      setGroups(groups || []);
      setStudents(students || []);
      setGroupMeta(
        meta || {
          names: [],
          numbers: [],
          usedNames: [],
          usedNumbers: [],
        }
      );
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />
        <AppSidebar />

        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <div className="flex justify-between gap-4 mb-1 mt-1">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                  Group Management
                </h1>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                {format(new Date(), "EEEE, MMMM d")}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              <div className="bg-white rounded-lg shadow-md">
                <GroupHeader
                  courseCode={course.code}
                  courseSection={course.section}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />

                <div className="p-6">
                  <GroupGrid
                    groups={filteredGroups}
                    isLoading={isLoading}
                    courseCode={courseSlug}
                    courseSection={course.section}
                    excludedStudentIds={excludedStudentIds}
                    nextGroupNumber={nextGroupNumber}
                    onGroupAdded={refreshData}
                    students={students}
                    groupMeta={groupMeta}
                    totalStudents={students.length}
                  />
                </div>
              </div>
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
