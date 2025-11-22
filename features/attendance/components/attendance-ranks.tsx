"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { useSession } from "next-auth/react";
import { useAttendanceRanking } from "@/lib/hooks/queries";

interface ClassStat {
  id: string;
  title: string;
  section: string;
  attendanceRate: number;
}

export default function AttendanceLeaderboard() {
  const { data: session, status } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // React Query hook
  const { data: rankingData, isLoading } = useAttendanceRanking(
    session?.user?.id
  );

  // Extract class stats from response
  let classStats: ClassStat[] = [];
  if (rankingData) {
    if (Array.isArray(rankingData)) {
      classStats = rankingData;
    } else if (Array.isArray(rankingData.classes)) {
      classStats = rankingData.classes;
    } else if (Array.isArray(rankingData.data)) {
      classStats = rankingData.data;
    }
  }

  // ✅ Skeleton Loader (Shadcn)
  if (isLoading || status === "loading" || !session?.user?.id) {
    return (
      <Card className="w-full p-4 -mb-5 shadow-md rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card
              key={i}
              className="rounded-lg shadow-md p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/2" /> {/* title */}
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-1/4" /> {/* section */}
                  <div className="relative">
                    <Skeleton className="h-9 w-9 rounded-full" /> {/* trophy */}
                    <Skeleton className="absolute inset-0 h-5 w-5 rounded-full opacity-50" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-4 w-2/3" /> {/* attendance rate */}
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center px-2 -mt-5 -mb-1">
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-md" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // ✅ No Data
  if (!classStats || classStats.length === 0) {
    return (
      <Card className="w-full p-4 flex justify-center items-center">
        <p className="text-gray-500">No attendance ranking data found.</p>
      </Card>
    );
  }

  // ✅ Actual Display
  const totalPages = Math.ceil(classStats.length / itemsPerPage);
  const currentClasses = classStats.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Card className="w-full p-4 -mb-5 shadow-md rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currentClasses.map((cls, index) => {
          const rank = (currentPage - 1) * itemsPerPage + index + 1;
          const bgColors = [
            "bg-[#F5C542]", // Gold
            "bg-[#D1D1D1]", // Silver
            "bg-[#CD7F32]", // Bronze
          ];
          const bgColor = bgColors[rank - 1] || "bg-[#E1E1E1]";

          return (
            <Card
              key={cls.id || index}
              className={`${bgColor} text-white rounded-lg shadow-md p-4 flex flex-col justify-between`}
            >
              <div>
                <h2 className="text-2xl text-black font-bold uppercase">
                  {cls.title}
                </h2>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-medium text-black opacity-90">
                    {cls.section}
                  </p>
                  <div className="relative">
                    <Trophy size={36} className="opacity-90 -ml-15 scale-300" />
                    <span className="absolute inset-0 flex mb-10 -ml-21 items-center justify-center text-4xl text-white pointer-events-none">
                      {rank}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm -mt-3 text-black opacity-90">
                {cls.attendanceRate}% attendance rate
              </p>
            </Card>
          );
        })}
      </div>

      {classStats.length > itemsPerPage && (
        <div className="flex justify-between items-center px-2 -mt-5 -mb-1">
          <p className="text-sm text-gray-500 w-100">
            {`${(currentPage - 1) * itemsPerPage + 1}-${Math.min(
              currentPage * itemsPerPage,
              classStats.length
            )} out of ${classStats.length} classes`}
          </p>
          <Pagination className="flex justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    isActive={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={
                      currentPage === i + 1 ? "bg-[#124A69] text-white" : ""
                    }
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
}
