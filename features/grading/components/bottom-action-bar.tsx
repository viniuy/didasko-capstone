import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BottomActionBarProps {
  activeReport: {
    name: string;
    scoringRange?: string;
  } | null;
  previousScores: Record<string, any> | null;
  isLoading: boolean;
  isLoadingStudents: boolean;
  hasChanges: () => boolean;
  isSaving: boolean;
  onReset: () => void;
  onEdit: () => void;
  onExport: () => void;
}

export function BottomActionBar({
  activeReport,
  previousScores,
  isLoading,
  isLoadingStudents,
  hasChanges,
  isSaving,
  onReset,
  onEdit,
  onExport,
}: BottomActionBarProps) {
  return (
    <div className="flex justify-between mt-3 sticky bottom-0 bg-white py-3 border-t">
      <div className="flex items-center text-sm text-gray-500">
        Rubric:{" "}
        <span className="font-medium text-[#124A69] ml-1">
          {activeReport?.name}
        </span>
        {activeReport?.scoringRange && (
          <>
            {" "}
            <span className="text-gray-400 mx-1">•</span>
            <span className="text-gray-500">
              Scoring Range:{" "}
              <span className="font-medium text-[#124A69]">
                1-{activeReport.scoringRange}
              </span>
            </span>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className={
            previousScores
              ? "h-9 px-4 bg-[#124A69] text-white hover:bg-[#0d3a56] border-none"
              : "h-9 px-4 border-gray-200 text-gray-600 hover:bg-gray-50"
          }
          disabled={
            isLoading || isLoadingStudents || (!previousScores && hasChanges())
          }
        >
          {previousScores ? "Undo Reset" : "Reset Grades"}
        </Button>

        {activeReport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-9 px-4 border-gray-200 text-gray-600 hover:bg-gray-50"
            disabled={isLoading || isLoadingStudents || hasChanges()}
          >
            Edit Rubric
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onExport}
          className="h-9 px-4 border-gray-200 text-gray-600 hover:bg-gray-50"
          disabled={
            isLoading || isLoadingStudents || !activeReport || hasChanges()
          }
        >
          Export to Excel
        </Button>
      </div>
    </div>
  );
}
