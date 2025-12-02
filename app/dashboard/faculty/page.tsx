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
import { hasAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Separate async component for stats
async function StatsContent({
  userId,
  userRole,
}: {
  userId: string;
  userRole: string;
}) {
  const [facultyStats, facultyCount] = await Promise.all([
    getFacultyStats(userId),
    getFacultyCount(),
  ]);

  return (
    <Stats
      initialFacultyStats={facultyStats}
      initialFacultyCount={facultyCount}
      userRole={userRole}
    />
  );
}

// Separate async component for courses
function CoursesContent({ coursesResult }: { coursesResult: any }) {
  // Check if user has no courses
  const hasNoCourses =
    !coursesResult ||
    (Array.isArray(coursesResult) && coursesResult.length === 0);

  if (hasNoCourses) {
    return <CourseEmptyState />;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="pl-1 sm:pl-2 pb-1 text-lg sm:text-xl md:text-2xl font-bold text-muted-foreground">
        My Courses
      </h2>
      <AllCourses type="attendance" initialCourses={coursesResult} />
    </div>
  );
}

export default async function FacultyDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  // Check permission to access faculty dashboard
  if (!hasAccess(session.user, "CAN_ACCESS_FACULTY_DASHBOARD")) {
    redirect("/403");
  }

  // Fetch courses to check if user has any
  const coursesResult = await getCourses({
    facultyId: session.user.id,
    status: "ACTIVE",
  });

  const hasNoCourses =
    !coursesResult ||
    (Array.isArray(coursesResult) && coursesResult.length === 0);

  return (
    <SidebarProvider>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />
        <AppSidebar />

        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-0 sm:pl-12 md:pl-16 lg:pl-[4rem] xl:pl-[5rem] transition-all overflow-y-auto">
          <div className="flex-1 px-2 sm:px-4 md:px-6">
            <div className="flex flex-col flex-grow">
              <div className="px-2 sm:px-4">
                {/* Greeting - shown immediately */}
                <Greet firstName={session.user.name?.split(" ")[0] || "User"} />

                {/* Stats */}
                <StatsContent
                  userId={session.user.id}
                  userRole={session.user.roles?.[0] || "FACULTY"}
                />

                {/* Courses */}
                <CoursesContent coursesResult={coursesResult} />
              </div>

              {/* Weekly Schedule - only show when there are courses */}
              {session.user.id && !hasNoCourses && (
                <WeeklySchedule
                  teacherInfo={{
                    id: session.user.id,
                  }}
                />
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <Rightsidebar />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
