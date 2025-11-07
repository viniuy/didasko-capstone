"use client";
import React, { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { format } from "date-fns";
import toast from "react-hot-toast";
import axiosInstance from "@/lib/axios";
import { ClassRecordTable } from "@/features/grading/components/class-record";

export default function GradebookCoursePage({
  params,
}: {
  params: Promise<{
    course_code: string;
    course_section: string;
    course_slug: string;
  }>;
}) {
  const resolvedParams = React.use(params);
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState<string>("");
  const [courseInfo, setCourseInfo] = useState<{
    code: string;
    section: string;
    title: string;
    classNumber: Int16Array;
  } | null>(null);

  useEffect(() => {
    const fetchCourseId = async () => {
      try {
        console.log("Fetching course ID for slug:", resolvedParams.course_slug);
        const response = await axiosInstance.get(
          `/courses/${resolvedParams.course_slug}`
        );
        if (response.data) {
          const course = response.data;
          const fetchedCourseId = course.id;
          setCourseId(fetchedCourseId);
          setCourseInfo({
            code: course.code,
            section: course.section,
            title: course.title,
            classNumber: course.classNumber,
          });
        } else {
          console.warn("No course found for the given slug");
        }
      } catch (error) {
        console.error("Error fetching course ID:", error);
        toast.error("Failed to fetch course information");
      }
    };

    fetchCourseId();
  }, [resolvedParams.course_slug]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <AppSidebar />
        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <Header />
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                  Class Record
                </h1>
                <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                  {format(new Date(), "EEEE, MMMM d")}
                </h1>
              </div>

              {courseId && courseInfo && (
                <ClassRecordTable
                  courseSlug={resolvedParams.course_slug}
                  courseCode={courseInfo.code}
                  courseSection={courseInfo.section}
                  courseTitle={courseInfo.title}
                  courseNumber={courseInfo.classNumber}
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
