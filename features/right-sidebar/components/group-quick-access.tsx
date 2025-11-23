"use client";

import { useParams } from "next/navigation";
import { useGroupsByCourse } from "@/lib/hooks/queries/useGroups";
import { Loader2, Users } from "lucide-react";
import Link from "next/link";

export default function GroupQuickAccess() {
  const params = useParams();
  const courseSlug = (params.course_slug || params.slug) as string;
  const currentGroupId = params.group_id as string | undefined;

  const { data: groupsData, isLoading } = useGroupsByCourse(courseSlug);

  const groups = groupsData?.groups || [];

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#124A69]" />
          <h3 className="text-sm font-semibold text-[#124A69]">Quick Access</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#124A69]" />
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#124A69]" />
          <h3 className="text-sm font-semibold text-[#124A69]">Quick Access</h3>
        </div>
        <p className="text-xs text-gray-500 text-center py-4">
          No groups available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-[#124A69]" />
        <h3 className="text-sm font-semibold text-[#124A69]">Quick Access</h3>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {groups.map((group: any) => {
          const isActive = currentGroupId === group.id;
          const groupUrl = `/main/grading/reporting/${courseSlug}/group/${group.id}`;

          return (
            <Link
              key={group.id}
              href={groupUrl}
              className={`block p-3 rounded-lg border transition-colors ${
                isActive
                  ? "bg-[#124A69] text-white border-[#124A69]"
                  : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    Group {group.number}
                  </span>
                  {group.name && (
                    <span
                      className={`text-xs ${
                        isActive ? "text-white/80" : "text-gray-500"
                      }`}
                    >
                      {group.name}
                    </span>
                  )}
                </div>
                {group.students && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {group.students.length}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
