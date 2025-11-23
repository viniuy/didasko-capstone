import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { format } from "date-fns";
import { getCourseBySlug } from "@/lib/services";
import { getClassRecordData } from "@/lib/services/grading";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { ClassRecordTable } from "@/features/grading/components/class-record";

export default async function GradebookCoursePage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const { course_slug } = await params;

  // Fetch course and class record data on the server
  const [course, classRecordData] = await Promise.all([
    getCourseBySlug(course_slug),
    getClassRecordData(course_slug),
  ]);

  if (!course || !classRecordData) {
    notFound();
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />
      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4">
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                Class Record
              </h1>
              <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                {format(new Date(), "EEEE, MMMM d")}
              </h1>
            </div>

            <ClassRecordTable
              courseSlug={course_slug}
              courseCode={course.code}
              courseSection={course.section}
              courseTitle={course.title}
              courseNumber={course.classNumber}
              initialData={classRecordData}
            />
          </div>
        </div>
        <Rightsidebar />
      </main>
    </div>
  );
}
