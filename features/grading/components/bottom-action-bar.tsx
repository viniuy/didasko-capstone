import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BottomActionBarProps {
  activeReport: {
    name: string;
  } | null;
  previousScores: Record<string, any> | null;
  isLoading: boolean;
  isLoadingStudents: boolean;
  hasChanges: () => boolean;
  isSaving: boolean;
  onReset: () => void;
  onEdit: () => void;
  onExport: () => void;
  onSave: () => void;
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
  onSave,
}: BottomActionBarProps) {
  return (
    <div className="flex justify-between mt-3 sticky bottom-0 bg-white py-3 border-t">
      <div className="flex items-center text-sm text-gray-500">
        Criteria:{" "}
        <span className="font-medium text-[#124A69] ml-1">
          {activeReport?.name}
        </span>
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
        <Button
          onClick={onSave}
          disabled={isLoading || !hasChanges() || isSaving}
          className="h-9 px-4 bg-[#124A69] text-white hover:bg-[#0d3a56] disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
        >
          {isSaving ? (
            <>
              <span className="absolute inset-0 flex items-center justify-center bg-[#124A69]">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              </span>
              <span className="opacity-0">Save Grades</span>
            </>
          ) : (
            "Save Grades"
          )}
        </Button>
      </div>
    </div>
  );
}
