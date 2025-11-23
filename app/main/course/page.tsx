import React, { Suspense } from "react";
import { CourseDataTable } from "@/features/courses/components/course-data-table";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/permission";
import { authOptions } from "@/lib/auth-options";
import { CourseTableSkeleton } from "@/shared/components/skeletons/course-skeletons";
import { CourseDataTableWrapper } from "@/features/courses/components/course-data-table-wrapper";

// Route segment config for performance
export const dynamic = "force-dynamic";
export const revalidate = 60; // ISR: revalidate every 60s

export default async function CourseDashboardPage() {
  // Pass authOptions to getServerSession
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/"); // Redirect to your sign-in page
  }

  // Extract user info from session
  const userId = session.user.id;
  const userRole = session.user.role as UserRole;

  // Redirect if no role or if student tries to access
  if (!userRole) {
    redirect("/"); // No role assigned
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4 overflow-y-auto">
          {/* Courses Table with Suspense */}
          <Suspense fallback={<CourseTableSkeleton />}>
            <CourseDataTableWrapper userRole={userRole} userId={userId} />
          </Suspense>
        </div>

        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
    </div>
  );
}
