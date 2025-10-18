"use client";

import React from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { format } from "date-fns";
import { GroupHeader } from "@/features/groups/components/group-header";
import { GroupGrid } from "@/features/groups/components/group-grid";
interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  description: string | null;
}

interface Group {
  id: string;
  number: string;
  name: string | null;
  students: {
    id: string;
    firstName: string;
    lastName: string;
    middleInitial: string | null;
    image: string | null;
  }[];
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    middleInitial: string | null;
    image: string | null;
  } | null;
}

// Server Component
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

  React.useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(
          `/api/courses/${resolvedParams.course_slug}`
        );
        if (!response.ok) throw new Error("Failed to fetch course");
        const data = await response.json();
        setCourse(data);
      } catch (error) {
        console.error("Error fetching course:", error);
      }
    };

    const fetchGroups = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/courses/${resolvedParams.course_slug}/groups`
        );
        if (!response.ok) throw new Error("Failed to fetch groups");
        const data = await response.json();
        setGroups(data);
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (resolvedParams.course_slug) {
      fetchCourse();
      fetchGroups();
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

  // Function to refresh groups after adding
  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/courses/${resolvedParams.course_slug}/groups`
      );
      if (!response.ok) throw new Error("Failed to fetch groups");
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <AppSidebar />

        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <Header />
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
                    onGroupAdded={fetchGroups}
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
