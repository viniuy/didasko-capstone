"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, User, Users, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { coursesService } from "@/lib/services/client";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  section: string;
  slug: string;
  academicYear: string;
}

function ReportingTypeContent({ course_slug }: { course_slug: string }) {
  const [open, setOpen] = React.useState(false);
  const [isIndividualRedirecting, setIsIndividualRedirecting] =
    React.useState(false);
  const [isGroupRedirecting, setIsGroupRedirecting] = React.useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setIsLoading(true);
        const course = await coursesService.getBySlug(course_slug);
        setCourse(course);
      } catch (error) {
        console.error("Error fetching course:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (course_slug) {
      fetchCourse();
    }
  }, [course_slug]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />
        <AppSidebar />

        <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <div className="flex-1 overflow-y-auto pb-6">
              <div className="mb-6 flex items-center mt-2 gap-4">
                <Button asChild variant="ghost" size="icon">
                  <Link href="/main/grading/reporting">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div>
                  <h1 className="text-2xl font-semibold">
                    {course?.title || "Loading..."}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {course?.section || "Loading..."}
                  </p>
                </div>
              </div>
              <div className="container mx-auto py-6 max-w-4xl">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="p-6 transition-colors h-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-12 w-12" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">
                          Individual Reporting
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Grade students one at a time
                        </p>
                      </div>
                      <Button
                        className={`
    w-full cursor-pointer transition-colors
    ${
      isLoading || isIndividualRedirecting
        ? "bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-400"
        : "bg-[#124A69] hover:bg-gray-800 text-white"
    }
  `}
                        disabled={isLoading || isIndividualRedirecting}
                        asChild
                      >
                        <Link
                          href={`/main/grading/reporting/${course_slug}/individual`}
                          onClick={() => setIsIndividualRedirecting(true)}
                        >
                          {isLoading ? (
                            "Loading..."
                          ) : isIndividualRedirecting ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Redirecting...
                            </span>
                          ) : (
                            "Select Student"
                          )}
                        </Link>
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-6 transition-colors  h-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center">
                        <Users className="h-12 w-12" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">
                          Group Reporting
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Grade multiple students at once
                        </p>
                      </div>
                      <Button
                        className={`
    w-full cursor-pointer transition-colors
    ${
      isLoading || isIndividualRedirecting
        ? "bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-400"
        : "bg-[#124A69] hover:bg-gray-800 text-white"
    }
  `}
                        disabled={isLoading || isGroupRedirecting}
                        asChild
                      >
                        <Link
                          href={`/main/grading/reporting/${course_slug}/group/`}
                          onClick={() => setIsGroupRedirecting(true)}
                        >
                          {isLoading ? (
                            "Loading..."
                          ) : isGroupRedirecting ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Redirecting...
                            </span>
                          ) : (
                            "Select Group"
                          )}
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function ReportingTypePage({
  params,
}: {
  params: Promise<{ course_slug: string }>;
}) {
  const resolvedParams = React.use(params);
  return <ReportingTypeContent course_slug={resolvedParams.course_slug} />;
}
