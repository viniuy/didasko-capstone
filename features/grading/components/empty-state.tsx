import { Loader2 } from "lucide-react";

interface EmptyStateProps {
  isLoading: boolean;
  isRecitationCriteria?: boolean;
}

export function EmptyState({
  isLoading,
  isRecitationCriteria = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#124A69]" />
          <p className="text-gray-500">Loading grading criteria...</p>
        </div>
      ) : (
        <>
          <div className="text-2xl font-semibold text-[#124A69] mb-2">
            {isRecitationCriteria
              ? "No Recitation Selected"
              : "No Report Selected"}
          </div>
          <p className="text-gray-500">
            {isRecitationCriteria
              ? "Please select a date and create or choose a recitation to begin."
              : "Please select a date and create or choose a grading report to begin."}
          </p>
        </>
      )}
    </div>
  );
}
