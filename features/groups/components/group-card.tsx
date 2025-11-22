import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Group } from "@/shared/types/groups";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useDeleteGroup } from "@/lib/hooks/queries";

interface GroupCardProps {
  group: Group;
  courseCode: string;
  courseSection: string;
  onGroupDeleted?: () => void;
}

export function GroupCard({
  group,
  courseCode,
  onGroupDeleted,
}: GroupCardProps) {
  const [isViewing, setIsViewing] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const router = useRouter();

  // React Query hook
  const deleteGroupMutation = useDeleteGroup();

  const handleDelete = async () => {
    try {
      await deleteGroupMutation.mutateAsync({
        courseSlug: courseCode,
        groupId: group.id,
      });

      if (onGroupDeleted) {
        await onGroupDeleted();
      }

      setShowConfirmDialog(false);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const handleViewGroup = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsViewing(true);
    router.push(`/main/grading/reporting/${courseCode}/group/${group.id}`);
  };

  return (
    <>
      <Card className="w-full sm:w-65 h-72 sm:h-80 p-4 sm:p-6 flex flex-col items-center shadow-lg relative mx-auto max-w-[280px] sm:max-w-none">
        <button
          onClick={() => setShowConfirmDialog(true)}
          className="absolute top-2 right-2 p-1.5 sm:p-1 rounded-full hover:bg-red-100 transition-colors touch-manipulation"
          title="Disband group"
        >
          <Trash2 className="h-5 w-5 sm:h-4 sm:w-4 text-red-500" />
        </button>
        <div className="mb-3 sm:mb-4">
          <svg
            className="h-16 w-16 sm:h-20 sm:w-20 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#124A69] text-center -mb-2">
          Group {group.number}
        </h2>
        {group.name ? (
          <p className="text-lg sm:text-xl text-[#124A69] font-sm text-center -mt-3 px-2">
            {group.name}
          </p>
        ) : (
          <div
            className="text-lg sm:text-xl text-[#124A69] font-sm text-center -mt-3"
            style={{ visibility: "hidden" }}
          >
            &nbsp;
          </div>
        )}
        <Button
          className="w-full bg-[#124A69] text-white font-semibold rounded mt-5 sm:mt-7 text-sm sm:text-base py-5 sm:py-auto touch-manipulation"
          onClick={handleViewGroup}
          disabled={isViewing}
        >
          {isViewing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            "View group"
          )}
        </Button>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Are you sure you want to disband this group?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action cannot be undone. This will permanently delete the
              group and remove all student associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#124A69] hover:bg-gray-600 text-white w-full sm:w-auto"
              disabled={deleteGroupMutation.isPending}
            >
              {deleteGroupMutation.isPending ? "Deleting..." : "Disband Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
