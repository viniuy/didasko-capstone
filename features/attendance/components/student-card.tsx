import { AttendanceStatus } from "@prisma/client";
import { AttendanceStatusWithNotSet } from "@/shared/types/attendance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

interface StudentCardProps {
  student: {
    id: string;
    name: string;
    status: AttendanceStatusWithNotSet;
    image?: string;
    date?: string;
    semester?: string;
  };
  index: number;
  tempImage: { index: number; dataUrl: string } | null;
  onImageUpload: (file: File) => void;
  onSaveChanges: (index: number) => void;
  onRemoveImage: (index: number, name: string) => void;
  onStatusChange: (index: number, status: AttendanceStatus) => void;
  isSaving?: boolean;
  isInCooldown?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  isSelecting?: boolean;
}

const statusStyles: Record<AttendanceStatusWithNotSet, string> = {
  LATE: "bg-[#FFF7E6] text-[#D4A017] border-[#D4A017]",
  ABSENT: "bg-[#FFEFEF] text-[#BA6262] border-[#BA6262]",
  PRESENT: "bg-[#EEFFF3] text-[#62BA7D] border-[#62BA7D]",
  EXCUSED: "bg-[#EEF2FF] text-[#8F9FDA] border-[#8F9FDA]",
  NOT_SET: "bg-white text-gray-500 border-gray-200",
};

export function StudentCard({
  student,
  index,
  tempImage,
  onImageUpload,
  onSaveChanges,
  onRemoveImage,
  onStatusChange,
  isSaving = false,
  isInCooldown = false,
  isSelected = false,
  onSelect,
}: StudentCardProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageToRemove, setImageToRemove] = useState<{
    index: number;
    name: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if the file is an image
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file", {
          style: {
            background: "#fff",
            color: "#dc2626",
            border: "1px solid #e5e7eb",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: "0.5rem",
            padding: "1rem",
          },
          iconTheme: {
            primary: "#dc2626",
            secondary: "#fff",
          },
        });
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      onImageUpload(file);
    }
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex flex-col items-center gap-3 relative">
        {onSelect && (
          <div className="absolute left-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(student.id)}
              className="w-4 h-4 accent-[#124A69] cursor-pointer"
            />
          </div>
        )}
        <div className="relative group">
          <div
            className="cursor-pointer"
            onClick={() => setShowImageDialog(true)}
          >
            {tempImage && tempImage.index === index ? (
              <img
                src={tempImage.dataUrl}
                alt={student.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : student.image ? (
              <img
                src={student.image}
                alt={student.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex w-16 h-16 rounded-full bg-gray-200 text-gray-400 items-center justify-center">
                <svg
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 20c0-2.2 3.6-4 6-4s6 1.8 6 4" />
                </svg>
              </span>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        <h3
          className="text-sm font-medium text-gray-900 w-full truncate text-center"
          title={student.name}
        >
          {student.name}
        </h3>
        <div className="w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`w-full rounded-full px-4 py-1.5 text-sm font-medium border ${
                  statusStyles[student.status]
                } ${isInCooldown ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isInCooldown}
              >
                {student.status === "NOT_SET"
                  ? "Select status"
                  : student.status}
                {isInCooldown && (
                  <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem
                onClick={() => onStatusChange(index, "PRESENT")}
                disabled={isInCooldown}
              >
                Present
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange(index, "LATE")}
                disabled={isInCooldown}
              >
                Late
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange(index, "ABSENT")}
                disabled={isInCooldown}
              >
                Absent
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange(index, "EXCUSED")}
                disabled={isInCooldown}
              >
                Excused
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              {student.name}'s Profile Picture
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              {tempImage && tempImage.index === index ? (
                <img
                  src={tempImage.dataUrl}
                  alt={student.name}
                  className="w-48 h-48 rounded-full object-cover"
                />
              ) : student.image ? (
                <img
                  src={student.image}
                  alt={student.name}
                  className="w-48 h-48 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex w-48 h-48 rounded-full bg-gray-200 text-gray-400 items-center justify-center">
                  <svg
                    width="80"
                    height="80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 20c0-2.2 3.6-4 6-4s6 1.8 6 4" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-[#124A69] text-white hover:bg-[#0D3A54] hover:text-white border-none"
              >
                <Camera className="h-4 w-4" />
                Change Picture
              </Button>
              {student.image && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setImageToRemove({ index, name: student.name });
                    setShowImageDialog(false);
                  }}
                  className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                  Remove Picture
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Image Confirmation Dialog */}
      <AlertDialog
        open={!!imageToRemove}
        onOpenChange={(open) => {
          setImageToRemove(null);
          if (!open) {
            setTimeout(() => {
              document.body.style.removeProperty("pointer-events");
            }, 300);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#124A69] text-xl font-bold">
              Remove Profile Picture
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              Are you sure you want to remove this profile picture? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel className="border-gray-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (imageToRemove) {
                  onRemoveImage(imageToRemove.index, imageToRemove.name);
                  setImageToRemove(null);
                }
              }}
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
