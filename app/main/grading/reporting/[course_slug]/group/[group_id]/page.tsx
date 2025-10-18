"use client";

import React from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ArrowLeft, Users, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Group } from "@/shared/types/groups";
import { GradingTable } from "@/features/grading/components/grading-table";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";

interface Course {
  id: string;
  code: string;
  section: string;
  name: string;
}

interface Rubric {
  id: string;
  name: string;
  date: string;
  criteria: {
    name: string;
    weight: number;
    isGroupCriteria: boolean;
  }[];
  scoringRange: string;
  passingScore: string;
}

interface GradingScore {
  studentId: string;
  scores: number[];
  total: number;
}

export default function GroupGradingPage({
  params,
}: {
  params: Promise<{
    course_code: string;
    course_section: string;
    group_id: string;
    course_slug: string;
  }>;
}) {
  const resolvedParams = React.use(params);
  const [open, setOpen] = React.useState(false);
  const [course, setCourse] = React.useState<Course | null>(null);
  const [group, setGroup] = React.useState<Group | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    new Date()
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [courseRes, groupRes] = await Promise.all([
          axiosInstance.get(`/courses/${resolvedParams.course_slug}`),
          axiosInstance.get(
            `/courses/${resolvedParams.course_slug}/groups/${resolvedParams.group_id}`
          ),
        ]);
        setCourse(courseRes.data);
        if (groupRes.data) {
          const transformedGroup: Group = {
            id: groupRes.data.id,
            number: groupRes.data.number,
            name: groupRes.data.name,
            students: groupRes.data.students.map((student: any) => ({
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              middleInitial: student.middleInitial,
              image: student.image,
            })),
            leader: groupRes.data.leader
              ? {
                  id: groupRes.data.leader.id,
                  firstName: groupRes.data.leader.firstName,
                  lastName: groupRes.data.leader.lastName,
                  middleInitial: groupRes.data.leader.middleInitial,
                  image: groupRes.data.leader.image,
                }
              : null,
          };
          setGroup(transformedGroup);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.course_slug, resolvedParams.group_id]);

  if (isLoading) {
    return (
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <div className="relative h-screen w-screen overflow-hidden">
          <AppSidebar />
          <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
            <div className="flex flex-col flex-grow px-4">
              <Header />
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                  Group
                </h1>
              </div>
              <div className="flex-1 overflow-y-auto pb-6">
                <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)]">
                  <Loader2 className="h-8 w-8 animate-spin text-[#A0A0A0]" />
                  <div className="text-center space-y-2 mt-4">
                    <p className="text-lg font-medium text-[#A0A0A0]">
                      Loading Group Information
                    </p>
                    <p className="text-sm text-[#A0A0A0]/70">
                      Please wait while we fetch your group details...
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

  if (!course || !group) {
    return (
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <div className="relative h-screen w-screen overflow-hidden">
          <AppSidebar />
          <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
            <div className="flex flex-col flex-grow px-4">
              <Header />
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#124A69]" />
                <p className="text-muted-foreground">
                  Fetching group information...
                </p>
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
                courseSlug={resolvedParams.course_slug}
                selectedDate={selectedDate}
                onDateSelect={(date) => setSelectedDate(date)}
                groupId={group.id}
                isGroupView={true}
              />
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
