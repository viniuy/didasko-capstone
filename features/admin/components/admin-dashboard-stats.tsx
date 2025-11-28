"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User as UserIcon,
  Library,
  Users,
  UserCheck,
  UserX,
} from "lucide-react";
import { useUsers } from "@/lib/hooks/queries";
import { AdminDataTable } from "./admin-data-table";
import { useMemo } from "react";
import { WorkType, UserStatus, Role } from "@prisma/client";

interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  role: Role;
  status: UserStatus;
  [key: string]: string | WorkType | Role | UserStatus;
}

interface AdminDashboardStatsProps {
  initialUsers: User[];
}

export function AdminDashboardStats({
  initialUsers,
}: AdminDashboardStatsProps) {
  // Use TanStack Query with initialData for client-side updates
  const { data: usersData } = useUsers({
    initialData: initialUsers,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Extract users array from response
  const users = useMemo(() => {
    if (!usersData) return initialUsers;
    if (Array.isArray(usersData)) return usersData;
    if (usersData.users && Array.isArray(usersData.users))
      return usersData.users;
    return initialUsers;
  }, [usersData, initialUsers]);

  // Calculate stats from users data
  const stats = useMemo(() => {
    const fullTimeCount = users.filter(
      (user: User) => user.workType === "FULL_TIME"
    ).length;
    const partTimeCount = users.filter(
      (user: User) => user.workType === "PART_TIME"
    ).length;
    const activeCount = users.filter(
      (user: User) => user.status === "ACTIVE"
    ).length;
    const archivedCount = users.filter(
      (user: User) => user.status === "ARCHIVED"
    ).length;
    const totalUsers = users.length;

    return {
      fullTimeCount,
      partTimeCount,
      activeCount,
      archivedCount,
      totalUsers,
    };
  }, [users]);

  return (
    <>
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5 mb-6 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Faculty Full-Time
            </CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fullTimeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Faculty Part-Time
            </CardTitle>
            <Library className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.partTimeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Archived Users
            </CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.archivedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <div className="mb-1">
        <AdminDataTable users={users} />
      </div>
    </>
  );
}
