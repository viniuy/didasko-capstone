"use client";

import React, { useState, useEffect } from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GradingTable } from "@/features/grading/components/grading-table";
import { coursesService } from "@/lib/services/client";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";

interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  slug: string;
  academicYear: string;
}

// Client Component
function IndividualRecitationContent({ course_slug }: { course_slug: string }) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
              <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                {format(new Date(), "EEEE, MMMM d")}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              {loading ? (
                <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px]">
                  <div className="flex flex-col items-center gap-4 mt-40">
                    <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
                      Loading Recitation Data...
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
              ) : !course ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Course not found</p>
                </div>
              ) : (
                <GradingTable
                  courseId={course.id}
                  courseCode={course.code}
                  courseSection={course.section}
                  courseSlug={course.slug}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  isRecitationCriteria={true}
                />
              )}
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}

// Server Component
export default function IndividualRecitationPage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const resolvedParams = React.use(params);
  return (
    <IndividualRecitationContent course_slug={resolvedParams.course_slug} />
  );
}
