"use client";

import React, { useState, useEffect } from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GradingTable } from "@/features/grading/components/grading-table";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { coursesService } from "@/lib/services/client";

interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  slug: string;
}

// Client Component
function IndividualGradingContent({ course_slug }: { course_slug: string }) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const course = await coursesService.getBySlug(course_slug);
        setCourse(course);
      } catch (error) {
        console.error("Error fetching course:", error);
      } finally {
        setLoading(false);
      }
    };

    if (course_slug) {
      fetchCourse();
    }
  }, [course_slug]);

  if (loading) {
    return (
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <div className="relative h-screen w-screen overflow-hidden">
          <AppSidebar />
          <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
            <div className="flex flex-col flex-grow px-4">
              <Header />
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                  Recitation
                </h1>
              </div>
              <div className="flex-1 overflow-y-auto pb-6">
                <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)]">
                  <Loader2 className="h-8 w-8 animate-spin text-[#A0A0A0]" />
                  <div className="text-center space-y-2 mt-4">
                    <p className="text-lg font-medium text-[#A0A0A0]">
                      Loading Course Information
                    </p>
                    <p className="text-sm text-[#A0A0A0]/70">
                      Please wait while we fetch your course details...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  if (!course) {
    return (
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <div className="relative h-screen w-screen overflow-hidden">
          <AppSidebar />
          <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
            <div className="flex flex-col flex-grow px-4">
              <Header />
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Course not found</p>
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <AppSidebar />
        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <Header />
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
              />
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}

// Server Component
export default function IndividualGradingPage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const { course_slug } = React.use(params);
  return <IndividualGradingContent course_slug={course_slug} />;
}
