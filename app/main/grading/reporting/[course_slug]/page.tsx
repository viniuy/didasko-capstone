import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, User, Users } from "lucide-react";
import { getCourseBySlug } from "@/lib/services";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { ReportingTypePageClient } from "@/features/grading/components/reporting-type-page-client";

export default async function ReportingTypePage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const { course_slug } = await params;

  // Fetch course data on the server
  const course = await getCourseBySlug(course_slug);

  if (!course) {
    notFound();
  }

  return (
    <ReportingTypePageClient
      course={{
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description,
        section: course.section,
        slug: course.slug,
        academicYear: course.academicYear,
      }}
      courseSlug={course_slug}
    />
  );
}
