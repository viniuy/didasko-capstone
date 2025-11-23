import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GradingTable } from "@/features/grading/components/grading-table";
import { getCourseBySlug, getCourseStudents } from "@/lib/services";
import { getRecitationCriteria } from "@/lib/services/criteria";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { RecitationPageClient } from "@/features/grading/components/recitation-page-client";

export const dynamic = "force-dynamic";

export default async function IndividualRecitationPage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const { course_slug } = await params;

  // Fetch course, students, and recitation criteria on the server
  const [course, studentsData, recitationCriteria] = await Promise.all([
    getCourseBySlug(course_slug),
    getCourseStudents(course_slug), // Fetch students for today (or no date)
    getRecitationCriteria(course_slug),
  ]);

  if (!course || !studentsData) {
    notFound();
  }

  // Map students to match client component interface (convert null to undefined)
  const mappedStudents = studentsData.students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    firstName: s.firstName,
    lastName: s.lastName,
    middleInitial: s.middleInitial ?? undefined,
    image: s.image ?? undefined,
  }));

  // Map criteria to match client component interface (convert types)
  const mappedCriteria = (recitationCriteria || []).map((c: any) => ({
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
    <RecitationPageClient
      course={{
        id: course.id,
        code: course.code,
        title: course.title,
        section: course.section,
        slug: course.slug,
        academicYear: course.academicYear,
      }}
      initialStudents={mappedStudents}
      initialRecitationCriteria={mappedCriteria}
    />
  );
}
