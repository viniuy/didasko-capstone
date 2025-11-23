import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getCourseWithGroupsData } from "@/lib/services/groups";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { GroupManagementPageClient } from "@/features/groups/components/group-management-page-client";

export const dynamic = "force-dynamic";

export default async function GroupGradingPage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const { course_slug } = await params;

  // Fetch course, groups, students, and metadata on the server
  const groupsData = await getCourseWithGroupsData(course_slug);

  if (!groupsData || !groupsData.course) {
    notFound();
  }

  // Map data to match client component interface
  const mappedCourse = {
    id: groupsData.course.id,
    code: groupsData.course.code,
    title: groupsData.course.title,
    section: groupsData.course.section,
    description: groupsData.course.description,
  };

  const mappedGroups = (groupsData.groups || []).map((g: any) => ({
    id: g.id,
    number: g.number,
    name: g.name,
    students: (g.students || []).map((s: any) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      middleInitial: s.middleInitial ?? undefined,
      image: s.image ?? undefined,
      status: "NOT_SET" as const,
    })),
    leader: g.leader
      ? {
          id: g.leader.id,
          firstName: g.leader.firstName,
          lastName: g.leader.lastName,
          middleInitial: g.leader.middleInitial ?? undefined,
          image: g.leader.image ?? undefined,
        }
      : null,
  }));

  const mappedStudents = (groupsData.students || []).map((s: any) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    middleInitial: s.middleInitial ?? undefined,
    image: s.image ?? undefined,
    name: `${s.firstName} ${s.lastName}`, // Add name field for GroupGrid compatibility
    status: "NOT_SET" as const,
  }));

  const mappedMeta = groupsData.meta || {
    names: [],
    numbers: [],
    usedNames: [],
    usedNumbers: [],
  };

  return (
    <GroupManagementPageClient
      course={mappedCourse}
      initialGroups={mappedGroups}
      initialStudents={mappedStudents}
      initialGroupMeta={mappedMeta}
      courseSlug={course_slug}
    />
  );
}
