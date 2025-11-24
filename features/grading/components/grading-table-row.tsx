import React, { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
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
import toast from "react-hot-toast";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  image?: string;
}

interface RubricDetail {
  name: string;
  percentage: number;
}

interface GradingTableRowProps {
  student: Student;
  rubricDetails: RubricDetail[];
  activeReport: any;
  studentScore: { scores: number[]; total: number };
  handleScoreChange: (
    studentId: string,
    rubricIdx: number,
    value: number
  ) => void;
  idx: number;
  onImageUpload: (index: number, file: File) => void;
  onSaveImageChanges: (index: number) => void;
  onRemoveImage: (index: number, name: string) => void;
  tempImage: { index: number; dataUrl: string } | null;
  isSaving: boolean;
  showSuccessMessage: { [key: number]: boolean };
  isLoading?: boolean;
}

const GradingTableRow: React.FC<GradingTableRowProps> = ({
  student,
  rubricDetails,
  activeReport,
  studentScore,
  handleScoreChange,
  idx,
  onImageUpload,
  onSaveImageChanges,
  onRemoveImage,
  tempImage,
  isSaving,
  showSuccessMessage,
  isLoading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageToRemove, setImageToRemove] = useState<{
    index: number;
    name: string;
  } | null>(null);

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
      onImageUpload(idx, file);
    }
  };

  return (
    <>
      <tr>
        <td className="sticky left-0 z-10 bg-white px-4 py-2 align-middle font-medium w-[300px]">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div>
                {tempImage && tempImage.index === idx ? (
                  <img
                    src={tempImage.dataUrl}
                    alt={student.firstName || "--"}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : student.image ? (
                  <img
                    src={student.image}
                    alt={student.firstName || "--"}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex w-8 h-8 rounded-full bg-gray-200 text-gray-400 items-center justify-center">
                    <svg
                      width="20"
                      height="20"
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
              {showSuccessMessage[idx] && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  ✓
                </div>
              )}
            </div>
            <span className="text-gray-700 truncate">
              {student.lastName && student.firstName
                ? `${student.lastName}, ${student.firstName}${
                    student.middleInitial ? ` ${student.middleInitial}.` : ""
                  }`
                : "--"}
            </span>
          </div>
        </td>
        {rubricDetails.map((rubric, rubricIdx) => {
          const value = studentScore.scores[rubricIdx] || "";
          let cellBg = "";
          if (value) {
            if (value <= 3) {
              cellBg = "bg-red-50";
            } else {
              cellBg = "bg-green-50";
            }
          }
          return (
            <td
              key={rubric.name + rubricIdx}
              className={`text-center px-4 py-2 align-middle w-[120px] ${cellBg}`}
            >
              {isLoading ? (
                <div className="w-full rounded border border-gray-300 px-2 py-1 bg-gray-50 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : (
              <select
                  className="w-full rounded border border-gray-300 px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                value={value}
                onChange={(e) =>
                  handleScoreChange(
                    student.id,
                    rubricIdx,
                    parseInt(e.target.value) || 0
                  )
                }
                  disabled={isLoading}
              >
                <option value="">Select grade</option>
                {Array.from(
                  { length: Number(activeReport.scoringRange) },
                  (_, i) => i + 1
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              )}
            </td>
          );
        })}
        <td className="text-center px-4 py-2 align-middle font-bold w-[100px]">
          {studentScore.total.toFixed(0)}%
        </td>
        <td className="text-center px-4 py-2 align-middle w-[100px]">
          {studentScore.scores.some((score) => score === 0) ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
              ---
            </span>
          ) : (
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                studentScore.total >= Number(activeReport.passingScore)
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {studentScore.total >= Number(activeReport.passingScore)
                ? "PASSED"
                : "FAILED"}
            </span>
          )}
        </td>
      </tr>

      {/* Image Preview Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#124A69] text-xl font-bold">
              {student.firstName}'s Profile Picture
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              {tempImage && tempImage.index === idx ? (
                <img
                  src={tempImage.dataUrl}
                  alt={student.firstName || "--"}
                  className="w-48 h-48 rounded-full object-cover"
                />
              ) : student.image ? (
                <img
                  src={student.image}
                  alt={student.firstName || "--"}
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
                    setImageToRemove({ index: idx, name: student.firstName });
                    setShowImageDialog(false);
                  }}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
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
    </>
  );
};

export default GradingTableRow;
