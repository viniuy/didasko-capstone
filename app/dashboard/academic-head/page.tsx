import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Stats from "@/features/dashboard/components/stats";
import Greet from "@/features/dashboard/components/greeting";
import AcademicHeadStats from "@/features/dashboard/components/academic-head-stats";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { getFacultyStats, getFacultyCount } from "@/lib/services/stats";
import {
  getFacultyWithHighestLoad,
  getCoursesWithWorstAttendance,
} from "@/lib/services/academic-head-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AcademicHeadDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  // Check permission to access academic head dashboard
  if (!hasAccess(session.user, "CAN_ACCESS_ACADEMIC_HEAD_DASHBOARD")) {
    redirect("/403");
  }

  // Fetch data on the server
  const [
    facultyStats,
    facultyCount,
    highestLoadFaculty,
    worstAttendanceCourses,
  ] = await Promise.all([
    getFacultyStats(session.user.id),
    getFacultyCount(),
    getFacultyWithHighestLoad(),
    getCoursesWithWorstAttendance(),
  ]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />

      <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-x-auto">
        <div className="flex-1 px-2 sm:px-4 md:px-6">
          <div className="flex flex-col flex-grow">
            <div className="px-2 sm:px-4">
              <Greet firstName={session.user.name?.split(" ")[0] || "User"} />

              <Stats
                initialFacultyStats={facultyStats}
                initialFacultyCount={facultyCount}
                userRole={session.user.roles?.[0] || "ACADEMIC_HEAD"}
              />

              <AcademicHeadStats
                highestLoadFaculty={highestLoadFaculty}
                worstAttendanceCourses={worstAttendanceCourses}
              />
            </div>
          </div>
        </div>

        <Rightsidebar />
      </main>
    </div>
  );
}
