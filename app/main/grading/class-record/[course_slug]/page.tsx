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

// Separate async component for class record content
async function ClassRecordContent({ courseSlug }: { courseSlug: string }) {
  // Fetch course and class record data on the server
  const [course, classRecordData] = await Promise.all([
    getCourseBySlug(courseSlug),
    getClassRecordData(courseSlug),
  ]);

  if (!course || !classRecordData) {
    notFound();
  }

  return (
    <ClassRecordTable
      courseSlug={courseSlug}
      courseCode={course.code}
      courseSection={course.section}
      courseTitle={course.title}
      courseNumber={course.classNumber}
      initialData={classRecordData}
    />
  );
}

export const dynamic = "force-dynamic";

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

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Header />
      <AppSidebar />
      <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-y-auto">
        <div className="flex flex-col px-4 pb-14">
          <div className="p-4">
            {/* Header - shown immediately */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                Class Record
              </h1>
              <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                {format(new Date(), "EEEE, MMMM d")}
              </h1>
            </div>

            {/* Class Record Table */}
            <ClassRecordContent courseSlug={course_slug} />
          </div>
        </div>
        <Rightsidebar />
      </main>
    </div>
  );
}
