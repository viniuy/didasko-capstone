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
import { coursesService, groupsService } from "@/lib/services/client";

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
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [course, groupData] = await Promise.all([
          coursesService.getBySlug(resolvedParams.course_slug),
          groupsService.getGroup(
            resolvedParams.course_slug,
            resolvedParams.group_id
          ),
        ]);
        setCourse(course);
        if (groupData) {
          const transformedGroup: Group = {
            id: groupData.id,
            number: groupData.number,
            name: groupData.name,
            students: groupData.students.map((student: any) => ({
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              middleInitial: student.middleInitial,
              image: student.image,
            })),
            leader: groupData.leader
              ? {
                  id: groupData.leader.id,
                  firstName: groupData.leader.firstName,
                  lastName: groupData.leader.lastName,
                  middleInitial: groupData.leader.middleInitial,
                  image: groupData.leader.image,
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

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <AppSidebar />
        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <Header />
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                {isLoading
                  ? "Group"
                  : `Group ${group?.number}${
                      group?.name ? ` - ${group.name}` : ""
                    }`}
              </h1>
              <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                {format(new Date(), "EEEE, MMMM d")}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              {isLoading ? (
                <div className="bg-white p-6 rounded-lg shadow-sm min-h-[840px] max-h-[840px]">
                  <div className="flex flex-col items-center gap-4 mt-40">
                    <h2 className="text-3xl font-bold text-[#124A69] animate-pulse">
                      Loading Group Reporting Data...
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
              ) : !course || !group ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-[#124A69]" />
                  <p className="text-muted-foreground">
                    Fetching group information...
                  </p>
                </div>
              ) : (
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
              )}
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
