import React, { Suspense } from "react";
import { CourseDashboard } from "@/features/courses/components/course-dashboard";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { getCourseAnalyticsData } from "@/lib/services/course-analytics";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { CourseDashboardSkeleton } from "@/shared/components/skeletons/course-skeletons";
import { CourseAccessGuard } from "@/features/courses/components/course-access-guard";
import { UserRole } from "@/lib/permission";

// Separate async component for course dashboard content
async function CourseDashboardContent({ courseSlug }: { courseSlug: string }) {
  const analyticsData = await getCourseAnalyticsData(courseSlug);

  if (!analyticsData) {
    notFound();
  }

  return (
    <CourseDashboard
      courseSlug={courseSlug}
      initialAnalyticsData={analyticsData}
    />
  );
}

export const dynamic = "force-dynamic";

export default async function CourseDashboardPage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const { course_slug } = await params;
  const userRoles = session.user.roles || [];
  const userRole = (userRoles[0] || "FACULTY") as UserRole;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4">
          {/* Course Dashboard Component with Suspense */}
          <div className="mb-4 overflow-y-auto">
            <CourseAccessGuard courseSlug={course_slug} userRole={userRole}>
              <Suspense fallback={<CourseDashboardSkeleton />}>
                <CourseDashboardContent courseSlug={course_slug} />
              </Suspense>
            </CourseAccessGuard>
          </div>
        </div>
        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
    </div>
  );
}
