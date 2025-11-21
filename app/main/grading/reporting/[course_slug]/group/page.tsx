"use client";

import React from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { GroupHeader } from "@/features/groups/components/group-header";
import { GroupGrid } from "@/features/groups/components/group-grid";
import type {
  Student,
  GroupMeta,
  Group,
  Course,
} from "@/features/groups/types";
import { groupsService } from "@/lib/services/client";

export default function GroupGradingPage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const resolvedParams = React.use(params);
  const [open, setOpen] = React.useState(false);
  const [course, setCourse] = React.useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [groups, setGroups] = React.useState<Group[]>([]);

  // State for students and group metadata
  const [students, setStudents] = React.useState<Student[]>([]);
  const [groupMeta, setGroupMeta] = React.useState<GroupMeta>({
    names: [],
    numbers: [],
    usedNames: [],
    usedNumbers: [],
  });
  const [isLoadingData, setIsLoadingData] = React.useState(true);

  // Fetch course, groups, students, and metadata on mount
  React.useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        setIsLoadingData(true);

        // Fetch all data using batched service
        const { course, groups, students, meta } =
          await groupsService.getCourseWithGroupsData(
            resolvedParams.course_slug
          );

        setCourse(course);
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
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingData(false);
      }
    };

    if (resolvedParams.course_slug) {
      fetchAllData();
    }
  }, [resolvedParams.course_slug]);

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
      const { course, groups, students, meta } =
        await groupsService.getCourseWithGroupsData(resolvedParams.course_slug);

      setCourse(course);
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
              {isLoadingData ? (
                <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px]">
                  <div className="flex flex-col items-center gap-4 mt-40">
                    <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
                      Loading Student Groups...
                    </h2>
                    <p
                      className="text-lg text-gray-600 animate-pulse"
                      style={{ animationDelay: "150ms" }}
                    >
                      Please sit tight while we are getting things ready for
                      you...
                    </p>
                    <div className="flex gap-2 mt-4">
                      {[0, 150, 300].map((delay, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 bg-[#124A69] rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md">
                  <GroupHeader
                    courseCode={course?.code || ""}
                    courseSection={course?.section || ""}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />

                  <div className="p-6">
                    <GroupGrid
                      groups={filteredGroups}
                      isLoading={isLoading}
                      courseCode={resolvedParams.course_slug}
                      courseSection={course?.section || ""}
                      excludedStudentIds={excludedStudentIds}
                      nextGroupNumber={nextGroupNumber}
                      onGroupAdded={refreshData}
                      students={students}
                      groupMeta={groupMeta}
                      totalStudents={students.length}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
