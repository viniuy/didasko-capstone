"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCircle, Shield, Wifi } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnlineUsers } from "@/lib/hooks/queries";

interface FacultyUser {
  id: string;
  name: string | null;
  email: string | null;
  roles: ("FACULTY" | "ACADEMIC_HEAD")[];
  department: string | null;
  workType: string | null;
  image: string | null;
}

const LoadingSkeleton = () => (
  <div className="space-y-2">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="bg-white/10 rounded-lg p-3">
        <Skeleton className="h-4 w-3/4 bg-white/20 mb-2" />
        <Skeleton className="h-3 w-1/2 bg-white/20" />
      </div>
    ))}
  </div>
);

const FacultyItem = ({ user }: { user: FacultyUser }) => {
  return (
    <div className="bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || "User"}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <UserCircle className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-[#124A69] rounded-full"></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white truncate">
              {user.name || "Unknown"}
            </h3>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                user.roles?.includes("ACADEMIC_HEAD")
                  ? "bg-blue-500/20 text-blue-200 border border-blue-500/30"
                  : "bg-green-500/20 text-green-200 border border-green-500/30"
              }`}
            >
              {user.roles?.includes("ACADEMIC_HEAD") ? "AH" : "F"}
            </span>
          </div>
          <p className="text-xs text-white/70 truncate">{user.email}</p>
          {user.department && (
            <p className="text-xs text-white/60 mt-1">{user.department}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ActiveFaculty() {
  // React Query hook with polling
  const { data: faculty = [], isLoading, error } = useOnlineUsers();

  // Separate faculty and academic heads
  const academicHeads = faculty.filter(
    (u: FacultyUser) => u.roles?.includes("ACADEMIC_HEAD")
  );
  const regularFaculty = faculty.filter(
    (u: FacultyUser) => u.roles?.includes("FACULTY")
  );

  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Online Faculty & Academic Heads
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-200">
              {error instanceof Error
                ? error.message
                : "Failed to load online users"}
            </p>
          </div>
        ) : faculty.length === 0 ? (
          <div className="text-sm text-white/60 text-center py-4">
            No faculty online
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto flex-1">
            {/* Academic Heads Section */}
            {academicHeads.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-blue-300" />
                  <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                    Academic Heads ({academicHeads.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {academicHeads.map((user: FacultyUser) => (
                    <FacultyItem key={user.id} user={user} />
                  ))}
                </div>
              </div>
            )}

            {/* Faculty Section */}
            {regularFaculty.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-300" />
                  <span className="text-xs font-semibold text-green-300 uppercase tracking-wide">
                    Faculty ({regularFaculty.length})
                  </span>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {regularFaculty.map((user: FacultyUser) => (
                    <FacultyItem key={user.id} user={user} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
