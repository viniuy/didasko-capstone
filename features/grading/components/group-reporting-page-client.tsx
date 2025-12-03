"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { format } from "date-fns";
import { GradingTable } from "@/features/grading/components/grading-table";

interface Course {
  id: string;
  code: string;
  section: string;
  slug: string;
}

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  image?: string;
}

interface Group {
  id: string;
  number: string;
  name: string;
  students: Student[];
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    middleInitial?: string;
    image?: string;
  } | null;
}

interface GroupReportingPageClientProps {
  course: Course;
  group: Group;
  courseSlug: string;
}

export function GroupReportingPageClient({
  course,
  group,
  courseSlug,
}: GroupReportingPageClientProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />
        <AppSidebar />
        <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                Group {group.number}
                {group.name ? ` - ${group.name}` : ""}
              </h1>
              <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                {format(new Date(), "EEEE, MMMM d")}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              <GradingTable
                courseId={course.id}
                courseCode={course.code}
                courseSection={course.section}
                courseSlug={courseSlug}
                selectedDate={selectedDate}
                onDateSelect={(date) => setSelectedDate(date)}
                groupId={group.id}
                isGroupView={true}
                initialStudents={group.students}
              />
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
