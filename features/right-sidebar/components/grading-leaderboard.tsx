"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, TrendingUp, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { statsService } from "@/lib/services/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StudentGrade {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  currentGrade: number;
  rank: number;
  improvement: number; // Percentage improvement from midterm to final
  isImproving: boolean;
}

interface GradingLeaderboardProps {
  courseSlug?: string;
}

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400/20 border-2 border-yellow-400">
        <Trophy className="h-4 w-4 text-yellow-400" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-300/20 border-2 border-gray-300">
        <Medal className="h-4 w-4 text-gray-300" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-400/20 border-2 border-orange-400">
        <Award className="h-4 w-4 text-orange-400" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white text-sm font-semibold">
      {rank}
    </div>
  );
};

const GradeBar = ({ grade }: { grade: number }) => {
  const getGradeColor = (grade: number) => {
    if (grade >= 90) return "bg-green-400";
    if (grade >= 80) return "bg-blue-400";
    if (grade >= 75) return "bg-yellow-400";
    return "bg-red-400";
  };

  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full ${getGradeColor(grade)} transition-all duration-500`}
        style={{ width: `${grade}%` }}
      />
    </div>
  );
};

const StudentRankCard = ({ student }: { student: StudentGrade }) => {
  return (
    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
      <div className="flex items-start gap-3">
        <RankBadge rank={student.rank} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {student.studentName}
              </h3>
              <p className="text-xs text-white/60">{student.studentNumber}</p>
            </div>

            <div className="text-right">
              <div className="text-lg font-bold text-white">
                {student.currentGrade.toFixed(1)}
              </div>
              {student.improvement !== 0 && (
                <div
                  className={`text-xs flex items-center gap-1 ${
                    student.isImproving ? "text-green-400" : "text-red-400"
                  }`}
                >
                  <TrendingUp
                    className={`h-3 w-3 ${
                      !student.isImproving && "rotate-180"
                    }`}
                  />
                  {Math.abs(student.improvement).toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          <div className="mt-2">
            <GradeBar grade={student.currentGrade} />
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="bg-white/10 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full bg-white/20" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 bg-white/20 mb-2" />
            <Skeleton className="h-3 w-1/2 bg-white/20 mb-2" />
            <Skeleton className="h-2 w-full bg-white/20" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function GradingLeaderboard({
  courseSlug,
}: GradingLeaderboardProps) {
  const { data: session, status } = useSession();
  const [topPerformers, setTopPerformers] = useState<StudentGrade[]>([]);
  const [mostImproved, setMostImproved] = useState<StudentGrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!session?.user?.id) return;

      try {
        const leaderboardData = await statsService.getGradesLeaderboard(
          courseSlug,
          courseSlug ? undefined : session.user.id
        );
        const data = Array.isArray(leaderboardData) ? leaderboardData : [];

        // Sort by current grade for top performers
        const sorted = [...data].sort(
          (a, b) => b.currentGrade - a.currentGrade
        );
        setTopPerformers(sorted.slice(0, 10));

        // Sort by improvement for most improved
        const improved = [...data]
          .filter((s) => s.improvement > 0)
          .sort((a, b) => b.improvement - a.improvement);
        setMostImproved(improved.slice(0, 10));
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setTopPerformers([]);
        setMostImproved([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchLeaderboard();
    }
  }, [status, session?.user?.id, courseSlug]);

  if (isLoading) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Grade Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (topPerformers.length === 0 && mostImproved.length === 0) {
    return (
      <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Grade Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Trophy className="mx-auto mb-2 text-white/50" size={40} />
            <p className="text-sm text-white/70">No grades available yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white text-lg flex items-center gap-2 -mb-8">
          <Trophy className="h-5 w-5" />
          Grade Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="top" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 bg-white/10">
            <TabsTrigger
              value="top"
              className="data-[state=active]:bg-white/20 text-white"
            >
              Top 10
            </TabsTrigger>
            <TabsTrigger
              value="improved"
              className="data-[state=active]:bg-white/20 text-white"
            >
              Most Improved
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="top"
            className="flex-1 overflow-y-auto mt-3 space-y-2"
          >
            {topPerformers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/70">No top performers yet</p>
              </div>
            ) : (
              topPerformers.map((student) => (
                <StudentRankCard key={student.id} student={student} />
              ))
            )}
          </TabsContent>

          <TabsContent
            value="improved"
            className="flex-1 overflow-y-auto mt-3 space-y-2"
          >
            {mostImproved.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/70">
                  No improvement data available
                </p>
              </div>
            ) : (
              mostImproved.map((student) => (
                <StudentRankCard key={student.id} student={student} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
