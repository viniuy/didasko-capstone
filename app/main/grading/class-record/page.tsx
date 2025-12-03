import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import SemesterCourses from "@/features/courses/components/semester-courses";
import { getCourses } from "@/lib/services";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function GradebookPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  // Check permission to access grading
  if (!hasAccess(session.user, "CAN_ACCESS_GRADING")) {
    redirect("/403");
  }

  // Fetch active courses for the current user on the server
  const coursesResult = await getCourses({
    facultyId: session.user.id,
    status: "ACTIVE",
  });

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />
      <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4">
          <h1 className="text-2xl font-bold text-gray-500">Class Record</h1>
          <div className="flex-1 p-4">
            <SemesterCourses
              type="class-record"
              initialCourses={coursesResult}
            />
          </div>
        </div>
        <Rightsidebar />
      </main>
    </div>
  );
}
