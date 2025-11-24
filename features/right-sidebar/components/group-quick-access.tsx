"use client";

import { useParams } from "next/navigation";
import { useGroupsByCourse } from "@/lib/hooks/queries/useGroups";
import { Loader2, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const LoadingSkeleton = () => (
  <div className="space-y-2">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="bg-white/10 rounded-lg p-3">
        <Skeleton className="h-4 w-3/4 bg-white/20 mb-2" />
        <Skeleton className="h-3 w-1/2 bg-white/20 mb-1" />
        <Skeleton className="h-3 w-1/3 bg-white/20" />
      </div>
    ))}
  </div>
);

export default function GroupQuickAccess() {
  const params = useParams();
  const courseSlug = (params.course_slug || params.slug) as string;
  const currentGroupId = params.group_id as string | undefined;

  const { data: groupsData, isLoading } = useGroupsByCourse(courseSlug);

  // API returns an array directly (from getGroups service)
  // Handle both array response and object with groups property for compatibility
  const allGroups = Array.isArray(groupsData)
    ? groupsData
    : groupsData?.groups || [];

  // Exclude the current group from the list
  const groups = allGroups.filter((group: any) => group.id !== currentGroupId);

  if (isLoading) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Quick Access
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Quick Access
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto mb-2 text-white/50" size={40} />
            <p className="text-sm text-white/70">No groups available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
          <Users className="h-5 w-5" />
          Quick Access
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto flex flex-col space-y-2">
        {groups.map((group: any) => {
          const isActive = currentGroupId === group.id;
          const groupUrl = `/main/grading/reporting/${courseSlug}/group/${group.id}`;

          return (
            <Link
              key={group.id}
              href={groupUrl}
              className={`block p-3 rounded-lg border transition-all duration-200 ${
                isActive
                  ? "bg-white/20 text-white border-white/40"
                  : "bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/40 text-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold truncate">
                    Group {group.number}
                  </span>
                  {group.name && (
                    <span
                      className={`text-xs truncate ${
                        isActive ? "text-white/80" : "text-white/70"
                      }`}
                    >
                      {group.name}
                    </span>
                  )}
                </div>
                {group.students && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2 ${
                      isActive
                        ? "bg-white/30 text-white"
                        : "bg-white/20 text-white/90"
                    }`}
                  >
                    {group.students.length}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
