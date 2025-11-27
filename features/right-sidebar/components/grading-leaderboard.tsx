"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, TrendingUp, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { statsService } from "@/lib/services/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StudentGrade {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  currentGrade: number;
  numericGrade?: string;
  rank: number;
  improvement: number; // Percentage improvement from midterm to final
  isImproving: boolean;
  termGrades?: {
    PRELIM: string | null;
    MIDTERM: string | null;
    PREFINALS: string | null;
    FINALS: string | null;
  };
}

interface GradeCount {
  grade: string;
  count: number;
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
                  title={
                    student.isImproving
                      ? `Improved by ${Math.abs(student.improvement).toFixed(
                          1
                        )}% compared to previous terms`
                      : `Declined by ${Math.abs(student.improvement).toFixed(
                          1
                        )}% compared to previous terms`
                  }
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
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
      <p className="text-sm text-white/60">Loading grades...</p>
    </div>
  </div>
);

const GradeCountTable = ({ gradeCounts }: { gradeCounts: GradeCount[] }) => {
  const getGradeColor = (grade: string) => {
    const numGrade = parseFloat(grade);
    if (numGrade <= 1.5) return "bg-green-400";
    if (numGrade <= 2.0) return "bg-blue-400";
    if (numGrade <= 2.5) return "bg-yellow-400";
    if (numGrade <= 3.0) return "bg-orange-400";
    return "bg-red-400";
  };

  return (
    <div className="w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/20">
            <th className="text-left py-2 px-2 text-white/80 font-semibold text-xs">
              Grade
            </th>
            <th className="text-right py-2 px-2 text-white/80 font-semibold text-xs">
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {gradeCounts.map((gradeCount) => (
            <tr
              key={gradeCount.grade}
              className="border-b border-white/10 hover:bg-white/5"
            >
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded ${getGradeColor(
                      gradeCount.grade
                    )} flex items-center justify-center flex-shrink-0`}
                  >
                    <span className="text-white font-bold text-xs">
                      {gradeCount.grade}
                    </span>
                  </div>
                </div>
              </td>
              <td className="py-2 px-2 text-right text-white font-medium">
                {gradeCount.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function GradingLeaderboard({
  courseSlug,
}: GradingLeaderboardProps) {
  const { data: session, status } = useSession();
  const [gradeCounts, setGradeCounts] = useState<GradeCount[]>([]);
  const [mostImproved, setMostImproved] = useState<StudentGrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<
    "PRELIM" | "MIDTERM" | "PREFINALS" | "FINALS" | "FINAL"
  >("FINAL");

  const fetchLeaderboard = useCallback(
    async (silent = false) => {
      if (!session?.user?.id) return;

      try {
        if (!silent) {
          setIsLoading(true);
        }

        const leaderboardData = await statsService.getGradesLeaderboard(
          courseSlug,
          courseSlug ? undefined : session.user.id
        );
        const data = Array.isArray(leaderboardData) ? leaderboardData : [];

        // Calculate grade counts based on selected term
        const gradeCountMap = new Map<string, number>();
        const gradeOrder = [
          "1.00",
          "1.25",
          "1.50",
          "1.75",
          "2.00",
          "2.25",
          "2.50",
          "2.75",
          "3.00",
          "5.00",
        ];

        data.forEach((student) => {
          let numericGrade: string | null = null;

          if (selectedTerm === "FINAL") {
            // Use final grade
            numericGrade =
              student.numericGrade ||
              (() => {
                // Fallback: calculate from currentGrade if numericGrade not provided
                const percent = student.currentGrade;
                if (percent >= 97.5) return "1.00";
                if (percent >= 94.5) return "1.25";
                if (percent >= 91.5) return "1.50";
                if (percent >= 86.5) return "1.75";
                if (percent >= 81.5) return "2.00";
                if (percent >= 76.0) return "2.25";
                if (percent >= 70.5) return "2.50";
                if (percent >= 65.0) return "2.75";
                if (percent >= 59.5) return "3.00";
                return "5.00";
              })();
          } else {
            // Use term-specific grade
            numericGrade = student.termGrades?.[selectedTerm] || null;
          }

          if (numericGrade) {
            gradeCountMap.set(
              numericGrade,
              (gradeCountMap.get(numericGrade) || 0) + 1
            );
          }
        });

        // Create grade count array in order - show all grades even with 0 count
        const counts: GradeCount[] = gradeOrder.map((grade) => ({
          grade,
          count: gradeCountMap.get(grade) || 0,
        }));

        setGradeCounts(counts);

        // Sort by improvement for most improved
        const improved = [...data]
          .filter((s) => s.improvement !== 0)
          .sort((a, b) => b.improvement - a.improvement);
        setMostImproved(improved.slice(0, 10));
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        // Only clear data if not in silent mode (initial load)
        if (!silent) {
          setGradeCounts([]);
          setMostImproved([]);
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [session?.user?.id, courseSlug, selectedTerm]
  );

  useEffect(() => {
    if (status === "authenticated") {
      fetchLeaderboard(false);
    }
  }, [status, fetchLeaderboard]);

  // Listen for grade updates to refresh seamlessly
  useEffect(() => {
    const handleGradesUpdated = (event: CustomEvent) => {
      const updatedCourseSlug = event.detail?.courseSlug;
      // Only refresh if this leaderboard matches the updated course
      // or if this is the general leaderboard (no courseSlug) and the event is for a course
      if (
        updatedCourseSlug === courseSlug ||
        (!courseSlug && updatedCourseSlug) ||
        (!courseSlug && !updatedCourseSlug)
      ) {
        // Silent refresh - keep old data visible while fetching
        fetchLeaderboard(true);
      }
    };

    window.addEventListener(
      "gradesUpdated",
      handleGradesUpdated as EventListener
    );

    return () => {
      window.removeEventListener(
        "gradesUpdated",
        handleGradesUpdated as EventListener
      );
    };
  }, [courseSlug, fetchLeaderboard]);

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

  if (gradeCounts.length === 0 && mostImproved.length === 0) {
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
        <Tabs defaultValue="grades" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 bg-white/10">
            <TabsTrigger
              value="grades"
              className="data-[state=active]:bg-white/20 text-white"
            >
              Grade Count
            </TabsTrigger>
            <TabsTrigger
              value="improved"
              className="data-[state=active]:bg-white/20 text-white"
            >
              Most Improved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grades" className="flex-1 overflow-y-auto mt-3">
            <div className="mb-3">
              <Select
                value={selectedTerm}
                onValueChange={(
                  value: "PRELIM" | "MIDTERM" | "PREFINALS" | "FINALS" | "FINAL"
                ) => setSelectedTerm(value)}
              >
                <SelectTrigger className="w-full bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FINAL">Final Grade</SelectItem>
                  <SelectItem value="PRELIM">Prelim</SelectItem>
                  <SelectItem value="MIDTERM">Midterm</SelectItem>
                  <SelectItem value="PREFINALS">Pre-Finals</SelectItem>
                  <SelectItem value="FINALS">Finals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {gradeCounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-white/70">No grades available yet</p>
              </div>
            ) : (
              <GradeCountTable gradeCounts={gradeCounts} />
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
                <p className="text-xs text-white/50 mt-2">
                  Improvement is calculated from MIDTERM to FINALS
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 px-1">
                  <p className="text-xs text-white/60 italic">
                    Ranked by improvement: compares current term vs average of
                    previous terms
                  </p>
                </div>
                {mostImproved.map((student) => (
                  <StudentRankCard key={student.id} student={student} />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
