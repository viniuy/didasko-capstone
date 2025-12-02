import React from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import Greet from "@/features/dashboard/components/greeting";
import { AdminDashboardStats } from "@/features/admin/components/admin-dashboard-stats";
import { getUsers } from "@/lib/services";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  // Check permission to access admin dashboard
  if (!hasAccess(session.user, "CAN_ACCESS_ADMIN_DASHBOARD")) {
    redirect("/403");
  }

  // Fetch users data on the server
  const users = await getUsers({});

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppSidebar />
      <Header />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-y-auto">
        <div className="flex flex-col flex-grow px-4">
          <AdminDashboardStats initialUsers={users} />
        </div>

        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
    </div>
  );
}
