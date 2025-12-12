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
      {/* Stats Cards - Small Version (Mobile/Tablet) */}
      <div className="grid gap-2 grid-cols-5 lg:hidden mb-3 mt-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-col items-center space-y-0 ">
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center mb-2">
              <UserIcon className="h-4 w-4 text-blue-600" />
            </div>
            <CardTitle className="text-[10px] md:text-xs font-medium text-gray-700 text-center">
              Full-Time
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="text-xl md:text-2xl font-bold text-gray-900 text-center">
              {stats.fullTimeCount}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-col items-center space-y-0 ">
            <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center mb-2">
              <Library className="h-4 w-4 text-purple-600" />
            </div>
            <CardTitle className="text-[10px] md:text-xs font-medium text-gray-700 text-center">
              Part-Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 text-center">
              {stats.partTimeCount}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-col items-center space-y-0 ">
            <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center mb-2">
              <UserCheck className="h-4 w-4 text-green-600" />
            </div>
            <CardTitle className="text-[10px] md:text-xs font-medium text-gray-700 text-center">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 text-center">
              {stats.activeCount}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-col items-center space-y-0 ">
            <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center mb-2">
              <UserX className="h-4 w-4 text-gray-600" />
            </div>
            <CardTitle className="text-[10px] md:text-xs font-medium text-gray-700 text-center">
              Archived
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 text-center">
              {stats.archivedCount}
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-2">
          <CardHeader className="flex flex-col items-center space-y-0 ">
            <div className="h-8 w-8 rounded-full bg-[#124A69] flex items-center justify-center mb-2">
              <Users className="h-4 w-4 text-white" />
            </div>
            <CardTitle className="text-[10px] md:text-xs font-medium text-[#124A69] text-center">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-[#124A69] text-center">
              {stats.totalUsers}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Big Version (Desktop) */}
      <div className="hidden lg:grid gap-3 grid-cols-5 mb-4 mt-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700">
              Full-Time
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.fullTimeCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Faculty members</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 ">
            <CardTitle className="text-sm font-medium text-gray-700">
              Part-Time
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
              <Library className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.partTimeCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Faculty members</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 ">
            <CardTitle className="text-sm font-medium text-gray-700">
              Active
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.activeCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Active users</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700">
              Archived
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
              <UserX className="h-5 w-5 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.archivedCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Archived users</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow  border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-[#124A69]">
              Total
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-[#124A69] flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#124A69]">
              {stats.totalUsers}
            </div>
            <p className="text-xs text-gray-500 mt-1">All users</p>
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
