import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { format } from "date-fns";
import { GradingTable } from "@/features/grading/components/grading-table";
import { getCourseBySlug } from "@/lib/services";
import { getGroupById, getGroupStudents } from "@/lib/services/groups";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { GroupReportingPageClient } from "@/features/grading/components/group-reporting-page-client";

export const dynamic = "force-dynamic";

export default async function GroupGradingPage({
  params,
}: {
  params: Promise<{
    course_code: string;
    course_section: string;
    group_id: string;
    course_slug: string;
  }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const resolvedParams = await params;
  const { course_slug, group_id } = resolvedParams;

  // Fetch course and group data on the server
  const [course, group] = await Promise.all([
    getCourseBySlug(course_slug),
    getGroupById(group_id),
  ]);

  if (!course || !group) {
    notFound();
  }

  // Map group students
  const groupStudents = (group.students || []).map((s) => ({
    id: s.id,
    studentId: s.studentId || "",
    firstName: s.firstName,
    lastName: s.lastName,
    middleInitial: s.middleInitial ?? undefined,
    image: s.image ?? undefined,
  }));

  return (
    <GroupReportingPageClient
      course={{
        id: course.id,
        code: course.code,
        section: course.section,
        slug: course.slug,
      }}
      group={{
        id: group.id,
        number: group.number,
        name: group.name,
        students: groupStudents,
        leader: group.leader
          ? {
              id: group.leader.id,
              firstName: group.leader.firstName,
              lastName: group.leader.lastName,
              middleInitial: group.leader.middleInitial ?? undefined,
              image: group.leader.image ?? undefined,
            }
          : null,
      }}
      courseSlug={course_slug}
    />
  );
}
