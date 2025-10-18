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
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isViewing, setIsViewing] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(
        `/api/courses/${courseCode}/groups/${group.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete group");
      }

      toast.success("Group disbanded successfully");
      if (onGroupDeleted) {
        onGroupDeleted();
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    } finally {
      setIsDeleting(false);
      setShowConfirmDialog(false);
    }
  };

  const handleViewGroup = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsViewing(true);
    router.push(`/main/grading/reporting/${courseCode}/group/${group.id}`);
  };

  return (
    <>
      <Card className="w-65 h-80 p-6 flex flex-col items-center shadow-lg relative">
        <button
          onClick={() => setShowConfirmDialog(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-100 transition-colors"
          title="Disband group"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
        <div className="mb-4">
          <svg
            className="h-20 w-20 text-gray-400"
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
        <h2 className="text-2xl font-bold text-[#124A69] text-center -mb-2">
          Group {group.number}
        </h2>
        {group.name ? (
          <p className="text-xl text-[#124A69] font-sm text-center -mt-3">
            {group.name}
          </p>
        ) : (
          <div
            className="text-xl text-[#124A69] font-sm text-center -mt-3"
            style={{ visibility: "hidden" }}
          >
            &nbsp;
          </div>
        )}
        <Button
          className="w-full bg-[#124A69] text-white font-semibold rounded mt-7"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to disband this group?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              group and remove all student associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#124A69] hover:bg-gray-600 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Disband Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
