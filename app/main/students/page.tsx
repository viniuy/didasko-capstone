import { getStudents } from "@/lib/services";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { StudentsPageClient } from "@/features/students/components/students-page-client";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || undefined;
  const limit = 50; // Reduced from 1000 for faster initial load

  // Fetch students data on the server with pagination
  const studentsResult = await getStudents({
    page,
    limit,
    search,
  });

  // Map students to match the client component interface
  const initialStudents = studentsResult.students.map((s) => ({
    id: s.id,
    rfid_id: s.rfid_id ? String(s.rfid_id) : null,
    lastName: s.lastName,
    firstName: s.firstName,
    middleInitial: s.middleInitial || "",
    studentImage: s.image,
    studentId: s.studentId,
  }));

  return (
    <StudentsPageClient
      initialStudents={initialStudents}
      initialPagination={studentsResult.pagination}
      initialSearch={search}
    />
  );
}
