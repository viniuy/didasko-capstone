import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GradingTable } from "@/features/grading/components/grading-table";
import { format } from "date-fns";
import { getCourseBySlug, getCourseStudents } from "@/lib/services";
import { getCriteria } from "@/lib/services/criteria";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { IndividualReportingPageClient } from "@/features/grading/components/individual-reporting-page-client";

export default async function IndividualGradingPage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const { course_slug } = await params;

  // Fetch course, students, and criteria on the server
  const [course, studentsData, criteria] = await Promise.all([
    getCourseBySlug(course_slug),
    getCourseStudents(course_slug),
    getCriteria(course_slug), // Get non-recitation, non-group criteria
  ]);

  if (!course || !studentsData) {
    notFound();
  }

  // Map students to match client component interface
  const mappedStudents = studentsData.students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    firstName: s.firstName,
    lastName: s.lastName,
    middleInitial: s.middleInitial ?? undefined,
    image: s.image ?? undefined,
  }));

  // Map criteria to match client component interface
  const mappedCriteria = (criteria || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    date: c.date instanceof Date ? c.date.toISOString() : c.date,
    courseId: c.courseId,
    userId: c.userId,
    scoringRange:
      typeof c.scoringRange === "string"
        ? parseFloat(c.scoringRange)
        : c.scoringRange,
    passingScore:
      typeof c.passingScore === "string"
        ? parseFloat(c.passingScore)
        : c.passingScore,
    isGroupCriteria: c.isGroupCriteria,
    isRecitationCriteria: c.isRecitationCriteria,
    rubrics: (c.rubrics || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      percentage:
        typeof r.percentage === "string"
          ? parseFloat(r.percentage)
          : r.percentage,
      criteriaId: r.criteriaId,
    })),
    user: c.user ? { name: c.user.name } : undefined,
  }));

  return (
    <IndividualReportingPageClient
      course={{
        id: course.id,
        code: course.code,
        title: course.title,
        section: course.section,
        slug: course.slug,
      }}
      initialStudents={mappedStudents}
      initialCriteria={mappedCriteria}
    />
  );
}
