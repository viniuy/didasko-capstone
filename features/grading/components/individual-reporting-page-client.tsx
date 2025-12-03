"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GradingTable } from "@/features/grading/components/grading-table";
import { format } from "date-fns";

interface Course {
  id: string;
  code: string;
  title: string;
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

interface Criteria {
  id: string;
  name: string;
  date: string | Date;
  courseId: string;
  userId: string;
  scoringRange: number;
  passingScore: number;
  isGroupCriteria: boolean;
  isRecitationCriteria: boolean;
  rubrics: Array<{
    id: string;
    name: string;
    percentage: number;
    criteriaId: string;
  }>;
  user?: {
    name: string | null;
  };
}

interface IndividualReportingPageClientProps {
  course: Course;
  initialStudents?: Student[];
  initialCriteria?: Criteria[];
}

export function IndividualReportingPageClient({
  course,
  initialStudents = [],
  initialCriteria = [],
}: IndividualReportingPageClientProps) {
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
                Individual Reporting
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
                courseSlug={course.slug}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                initialStudents={initialStudents}
                initialCriteria={initialCriteria}
              />
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
