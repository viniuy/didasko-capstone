"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Library, Users, UserCheck, UserX } from "lucide-react";
import { useAdminDashboardData } from "@/lib/hooks/queries";
import { AdminDataTable } from "./admin-data-table";

export function AdminDashboardStats() {
  const queries = useAdminDashboardData();

  // Extract data from queries
  const [
    studentsCountQuery,
    teachersCountQuery,
    coursesCountQuery,
    attendanceCountQuery,
    recentActivityQuery,
    usersQuery,
    fullTimeCountQuery,
    partTimeCountQuery,
    grantedCountQuery,
    deniedCountQuery,
    totalUsersQuery,
  ] = queries;

  const isLoading =
    studentsCountQuery.isLoading ||
    teachersCountQuery.isLoading ||
    coursesCountQuery.isLoading ||
    attendanceCountQuery.isLoading ||
    recentActivityQuery.isLoading ||
    usersQuery.isLoading ||
    fullTimeCountQuery.isLoading ||
    partTimeCountQuery.isLoading ||
    grantedCountQuery.isLoading ||
    deniedCountQuery.isLoading ||
    totalUsersQuery.isLoading;

  const fullTimeCount = fullTimeCountQuery.data || 0;
  const partTimeCount = partTimeCountQuery.data || 0;
  const grantedCount = grantedCountQuery.data || 0;
  const deniedCount = deniedCountQuery.data || 0;
  const totalUsers = totalUsersQuery.data || 0;
  const users = usersQuery.data || [];

  return (
    <>
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5 mb-6 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Faculty Full-Time
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : fullTimeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Faculty Part-Time
            </CardTitle>
            <Library className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : partTimeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Granted Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : grantedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denied Users</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : deniedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : totalUsers}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <div className="mb-4">
        <AdminDataTable users={users} />
      </div>
    </>
  );
}
