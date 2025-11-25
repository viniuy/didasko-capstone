"use client";

import { CourseDataTable } from "@/features/courses/components/course-data-table";
import { useActiveCourses } from "@/lib/hooks/queries";
import type { UserRole } from "@/lib/permission";

interface CourseDataTableWrapperProps {
  userRole: UserRole;
  userId: string;
}

export function CourseDataTableWrapper({
  userRole,
  userId,
}: CourseDataTableWrapperProps) {
  const { data: coursesData, isLoading } = useActiveCourses({
    filters: { facultyId: userId },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const courses = coursesData?.courses || [];

  return (
    <CourseDataTable courses={courses} userRole={userRole} userId={userId} />
  );
}
