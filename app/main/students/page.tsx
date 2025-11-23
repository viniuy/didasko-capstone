import { getStudents } from "@/lib/services";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { StudentsPageClient } from "@/features/students/components/students-page-client";

export default async function StudentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  // Fetch students data on the server
  const studentsResult = await getStudents({
    page: 1,
    limit: 1000, // Get all students for initial load
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

  return <StudentsPageClient initialStudents={initialStudents} />;
}
