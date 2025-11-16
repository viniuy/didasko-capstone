import React, { useState, useEffect } from "react";
import { Shuffle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "react-hot-toast";

interface Student {
  id: string;
  name: string;
  status: string;
}

interface StudentWithGroup extends Student {
  groupNumber?: number;
  isAssigned?: boolean;
}

interface RandomizerShakeProps {
  students: Student[];
  excludedStudentIds: string[];
  courseCode: string;
  onGroupsCreated: () => void;
}

export function WheelRandomizer({
  students,
  excludedStudentIds,
  courseCode,
  onGroupsCreated,
}: RandomizerShakeProps) {
  const [open, setOpen] = useState(false);
  const [groupSize, setGroupSize] = useState(4);
  const [isShaking, setIsShaking] = useState(false);
  const [studentsWithGroups, setStudentsWithGroups] = useState<
    StudentWithGroup[]
  >([]);
  const [assignedGroups, setAssignedGroups] = useState<StudentWithGroup[][]>(
    []
  );
  const [isCreating, setIsCreating] = useState(false);
  const [currentAssigning, setCurrentAssigning] = useState(-1);

  const availableStudents = students.filter(
    (s) => !excludedStudentIds.includes(s.id)
  );

  useEffect(() => {
    if (open) {
      setStudentsWithGroups(availableStudents.map((s) => ({ ...s })));
      setAssignedGroups([]);
      setCurrentAssigning(-1);
    }
  }, [open]);

  const shuffleAndAssign = async () => {
    if (availableStudents.length < groupSize) {
      toast.error(`Need at least ${groupSize} students to form groups`);
      return;
    }

    setIsShaking(true);

    // Shake animation for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Shuffle students
    const shuffled = [...availableStudents].sort(() => Math.random() - 0.5);

    // Assign to groups
    const groups: StudentWithGroup[][] = [];
    let currentGroup: StudentWithGroup[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      currentGroup.push({ ...shuffled[i], groupNumber: groups.length + 1 });

      if (currentGroup.length === groupSize) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }

    // Handle remaining students
    if (currentGroup.length > 0) {
      if (currentGroup.length === 1 && groups.length > 0) {
        // Add single remaining student to last group
        groups[groups.length - 1].push({
          ...currentGroup[0],
          groupNumber: groups.length,
        });
      } else {
        // Make a smaller final group
        groups.push(
          currentGroup.map((s) => ({ ...s, groupNumber: groups.length + 1 }))
        );
      }
    }

    setIsShaking(false);

    // Animate assignment one by one
    const allStudentsFlat = groups.flat();
    for (let i = 0; i < allStudentsFlat.length; i++) {
      setCurrentAssigning(i);
      allStudentsFlat[i].isAssigned = true;
      setStudentsWithGroups([...allStudentsFlat]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    setCurrentAssigning(-1);
    setAssignedGroups(groups);
  };

  const createGroups = async () => {
    try {
      setIsCreating(true);
      console.log("🎲 Creating groups:", assignedGroups.length);

      for (let i = 0; i < assignedGroups.length; i++) {
        const group = assignedGroups[i];

        const response = await fetch(`/api/courses/${courseCode}/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupNumber: String(i + 1),
            groupName: `Random Group ${i + 1}`,
            studentIds: group.map((s) => s.id),
            leaderId: group[0].id,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create group");
        }

        // Small delay between group creations
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Wait longer to ensure all database writes are complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Make sure the callback is awaited
      await onGroupsCreated();

      toast.success(`${assignedGroups.length} groups created successfully! 🎉`);
      setOpen(false);
    } catch (error) {
      console.error("❌ Error creating groups:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create groups"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setStudentsWithGroups(availableStudents.map((s) => ({ ...s })));
    setAssignedGroups([]);
    setCurrentAssigning(-1);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={availableStudents.length < 2}
        className="relative flex flex-col items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        style={{ width: "7rem", height: "7rem" }}
      >
        <div className="relative flex items-center justify-center">
          <svg
            className="h-16 w-16 sm:h-20 sm:w-20 text-gray-400 opacity-70"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2 L12 12 L18 16" />
          </svg>
          <Shuffle
            className="h-8 w-8 sm:h-10 sm:w-10 text-white absolute"
            strokeWidth={2.5}
          />
        </div>
        <span className="mt-2 text-xs font-semibold text-gray-600 text-center px-2">
          Randomizer
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-[#124A69] flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
              Magic Group Randomizer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 py-4">
            {/* Settings */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-lg border-2 border-gray-200">
              <label className="text-sm font-semibold text-[#124A69] whitespace-nowrap">
                Students per group:
              </label>
              <Input
                type="number"
                min={2}
                max={10}
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                className="w-20"
                disabled={assignedGroups.length > 0}
              />
              <span className="text-xs sm:text-sm text-gray-600">
                {availableStudents.length} students → ~
                {Math.floor(availableStudents.length / groupSize)} groups
              </span>
            </div>

            {/* Student Cards Grid */}
            <div className="min-h-[300px] sm:min-h-[400px] bg-gray-50 rounded-lg p-3 sm:p-6">
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 ${
                  isShaking ? "animate-shake" : ""
                }`}
              >
                {studentsWithGroups.map((student, idx) => (
                  <div
                    key={student.id}
                    className={`
                      relative p-2.5 sm:p-4 rounded-lg border-2 transition-all duration-300 transform
                      ${
                        student.isAssigned
                          ? "bg-[#124A69] text-white border-[#124A69] scale-105 shadow-lg"
                          : "bg-white border-gray-200 hover:border-[#124A69]/30"
                      }
                      ${
                        currentAssigning === idx
                          ? "ring-2 sm:ring-4 ring-[#124A69] ring-offset-2 scale-110"
                          : ""
                      }
                      ${isShaking ? "animate-bounce" : ""}
                    `}
                    style={{
                      animationDelay: isShaking ? `${idx * 50}ms` : "0ms",
                      animationDuration: isShaking ? "0.5s" : "0ms",
                    }}
                  >
                    {student.groupNumber && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 sm:w-8 sm:h-8 bg-white text-[#124A69] rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2 border-[#124A69]">
                        {student.groupNumber}
                      </div>
                    )}
                    <div
                      className={`text-xs sm:text-sm font-medium truncate ${
                        student.isAssigned ? "text-white" : "text-gray-700"
                      }`}
                    >
                      {student.name}
                    </div>
                    {student.isAssigned && (
                      <div className="mt-1 text-[10px] sm:text-xs text-white/90 font-semibold">
                        ✓ Group {student.groupNumber}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {studentsWithGroups.length === 0 && (
                <div className="text-center py-12 sm:py-20 text-gray-400">
                  <Shuffle className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm sm:text-base">No students available</p>
                </div>
              )}
            </div>

            {/* Groups Summary */}
            {assignedGroups.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border-2 border-[#124A69]">
                <h3 className="font-bold text-sm sm:text-base text-[#124A69] mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                  Groups Created: {assignedGroups.length}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 max-h-[150px] sm:max-h-[200px] overflow-y-auto">
                  {assignedGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg p-2.5 sm:p-3 border-2 border-gray-200 shadow-sm hover:border-[#124A69]/30 transition-colors"
                    >
                      <div className="font-semibold text-xs sm:text-sm mb-2 text-[#124A69] flex items-center gap-2">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#124A69] text-white rounded-full flex items-center justify-center text-xs">
                          {idx + 1}
                        </div>
                        Group {idx + 1}
                      </div>
                      <div className="space-y-1">
                        {group.map((s, sIdx) => (
                          <div
                            key={s.id}
                            className="text-[10px] sm:text-xs text-gray-600 flex items-center gap-1"
                          >
                            <span className="text-gray-400">
                              {sIdx === 0 ? "👑" : "•"}
                            </span>
                            <span className="truncate">{s.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t">
              {assignedGroups.length === 0 ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="flex-1 touch-manipulation"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={shuffleAndAssign}
                    disabled={isShaking || availableStudents.length < groupSize}
                    className="flex-1 bg-[#124A69] hover:bg-[#0d3a56] text-white font-semibold touch-manipulation"
                  >
                    {isShaking ? (
                      <>
                        <Shuffle className="mr-2 h-4 w-4 animate-spin" />
                        Shuffling Magic...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Shuffle & Assign!
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={reset}
                    disabled={isCreating}
                    className="flex-1 touch-manipulation"
                  >
                    Reset & Try Again
                  </Button>
                  <Button
                    onClick={createGroups}
                    disabled={isCreating}
                    className="flex-1 bg-[#124A69] hover:bg-[#0d3a56] text-white font-semibold touch-manipulation text-sm sm:text-base"
                  >
                    {isCreating
                      ? "Creating..."
                      : `Create ${assignedGroups.length} Groups 🎉`}
                  </Button>
                </>
              )}
            </div>
          </div>

          <style jsx>{`
            @keyframes shake {
              0%,
              100% {
                transform: translateX(0);
              }
              10%,
              30%,
              50%,
              70%,
              90% {
                transform: translateX(-5px);
              }
              20%,
              40%,
              60%,
              80% {
                transform: translateX(5px);
              }
            }
            .animate-shake {
              animation: shake 0.5s ease-in-out;
            }
          `}</style>
        </DialogContent>
      </Dialog>
    </>
  );
}
