"use client";

import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axios";

interface ClassStat {
  id: string;
  title: string;
  section: string;
  attendanceRate: number;
}

export default function AttendanceLeaderboard() {
  const { data: session, status } = useSession();
  const [classStats, setClassStats] = useState<ClassStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  useEffect(() => {
    const fetchClassStats = async () => {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await axiosInstance.get(
          "/courses/attendance-ranking",
          {
            params: { facultyId: session.user.id },
          }
        );

        // Defensive: Try all possible shapes
        let data: ClassStat[] = [];
        if (Array.isArray(response.data)) {
          data = response.data;
        } else if (Array.isArray(response.data.classes)) {
          data = response.data.classes;
        } else if (Array.isArray(response.data.data)) {
          data = response.data.data;
        }

        setClassStats(data);
        console.log("Fetched class stats:", data);
        console.log("Full API responsonse:", response.data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching attendance stats:", error);
        setClassStats([]);
        setIsLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchClassStats();
    }
  }, [status, session?.user?.id]);

  // Defensive: Don't render if loading or not authenticated
  if (isLoading || status === "loading") {
    return (
      <Card className="w-full p-4 flex justify-center items-center">
        <p className="text-gray-500">Loading attendance ranking...</p>
      </Card>
    );
  }

  // Defensive: Show message if no data
  if (!classStats || classStats.length === 0) {
    return (
      <Card className="w-full p-4 flex justify-center items-center">
        <p className="text-gray-500">No attendance ranking data found.</p>
      </Card>
    );
  }

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
            "bg-[#F5C542]", // 1st gold
            "bg-[#D1D1D1]", // 2nd silver
            "bg-[#CD7F32]", // 3rd bronze
          ];
          const bgColor = bgColors[rank - 1] || "bg-[#E1E1E1]";

          return (
            <Card
              key={cls.id || index}
              className={`${bgColor} text-white rounded-lg shadow-md p-4 flex flex-col justify-between`}
            >
              <div>
                <h2 className="text-2xl font-bold uppercase">{cls.title}</h2>

                <div className="flex items-center justify-between">
                  <p className="text-xl font-medium opacity-90">
                    {cls.section}
                  </p>

                  <div className="relative">
                    <Trophy size={36} className="opacity-90 -ml-15 scale-300" />
                    <span className="absolute inset-0 flex mb-10 -ml-21 items-center justify-center text-4xl  text-shadow-lg text-white pointer-events-none">
                      {rank}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm -mt-3 text-gray-500 font-semibold opacity-90">
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
