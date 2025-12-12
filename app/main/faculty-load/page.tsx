"use client";
import React from "react";
import { useSession } from "next-auth/react";
import { hasAccess } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import FacultyLoad from "@/features/faculty/components/faculty-load";
import { SidebarProvider } from "@/components/ui/sidebar";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import Header from "@/shared/components/layout/header";
import { format } from "date-fns";

export default function FacultyLoadPage() {
  const [open, setOpen] = React.useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || !hasAccess(session.user, "CAN_ACCESS_FACULTY_LOAD")) {
      router.replace("/403");
    }
  }, [session, status, router]);

  if (
    status === "loading" ||
    !session?.user ||
    !hasAccess(session.user, "CAN_ACCESS_FACULTY_LOAD")
  ) {
    return null;
  }

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />

        <AppSidebar />
        <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
          <div className="flex flex-col flex-grow px-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                Faculty Overview
              </h1>
            </div>

            <div className="flex-1 p-4">
              <FacultyLoad />
            </div>
          </div>
          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
