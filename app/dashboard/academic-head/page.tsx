import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Stats from "@/features/dashboard/components/stats";
import Greet from "@/features/dashboard/components/greeting";
import AllCourses from "@/features/courses/components/all-courses";
import WeeklySchedule from "@/features/dashboard/components/weekly-schedule";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { getCourses } from "@/lib/services";
import { getFacultyStats, getFacultyCount } from "@/lib/services/stats";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import CourseEmptyState from "@/features/courses/components/course-empty-state";

export const dynamic = "force-dynamic";

export default async function AcademicHeadDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  // Fetch data on the server
  const [coursesResult, facultyStats, facultyCount] = await Promise.all([
    getCourses({
      facultyId: session.user.id,
      status: "ACTIVE",
    }),
    getFacultyStats(session.user.id),
    getFacultyCount(),
  ]);

  // Check if user has no courses
  const hasNoCourses =
    !coursesResult ||
    (Array.isArray(coursesResult) && coursesResult.length === 0);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppSidebar />
      <Header />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-0 sm:pl-12 md:pl-16 lg:pl-[4rem] xl:pl-[5rem] transition-all overflow-y-auto">
        <div className="flex-1 px-2 sm:px-4 md:px-6">
          <div className="flex flex-col flex-grow">
            <div className="px-2 sm:px-4">
              <Greet firstName={session.user.name?.split(" ")[0] || "User"} />

              <Stats
                initialFacultyStats={facultyStats}
                initialFacultyCount={facultyCount}
                userRole={session.user.role}
              />

              {hasNoCourses ? (
                <CourseEmptyState />
              ) : (
                // Show courses and schedule when courses exist
                <>
                  <div className="space-y-3 sm:space-y-4">
                    <h2 className="pl-1 sm:pl-2 pb-1 text-lg sm:text-xl md:text-2xl font-bold text-muted-foreground">
                      Your Subjects
                    </h2>
                    <AllCourses
                      type="attendance"
                      initialCourses={coursesResult}
                    />
                  </div>

                  {session.user.id && (
                    <WeeklySchedule
                      teacherInfo={{
                        id: session.user.id,
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <Rightsidebar />
        </div>
      </main>
    </div>
  );
}
