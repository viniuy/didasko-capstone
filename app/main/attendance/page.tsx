import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import React from "react";
import AttendanceLeaderboard from "@/features/attendance/components/attendance-ranks";
import SemesterCourses from "@/features/courses/components/semester-courses";
import { getCourses } from "@/lib/services";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  // Check permission to access attendance
  if (!hasAccess(session.user, "CAN_ACCESS_ATTENDANCE")) {
    redirect("/403");
  }

  // Fetch active courses for the current user on the server
  const coursesResult = await getCourses({
    facultyId: session.user.id,
    status: "ACTIVE",
  });

  return (
    <div className="relative min-h-screen w-full bg-background overflow-x-hidden">
      <Header />
      <AppSidebar />
      <main className="h-full w-full transition-all overflow-y-auto pt-2 pb-4">
        <div className="max-w-screen-xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 flex flex-col flex-grow">
          <div className="space-y-2 md:space-y-6 lg:space-y-8">
            <div className="space-y-2">
              <h1 className="pb-1 text-xl sm:text-2xl font-bold text-muted-foreground break-words">
                Overview of Attendance
              </h1>
              <div className="grid gap-4 md:gap-6 lg:gap-8">
                <SemesterCourses
                  type="attendance"
                  initialCourses={coursesResult}
                />
              </div>
            </div>
          </div>
        </div>
        <Rightsidebar />
      </main>
    </div>
  );
}
