import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

interface PasteGradesDialogProps {
  onPaste: (type: string, target: string, grades: string) => void;
  students: Array<{ id: string; name: string }>;
  maxValues: {
    pt1: string;
    pt2: string;
    pt3: string;
    pt4: string;
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    examMax: string;
  };
}

const COLUMNS = [
  { id: "pt1", label: "PT/Lab 1" },
  { id: "pt2", label: "PT/Lab 2" },
  { id: "pt3", label: "PT/Lab 3" },
  { id: "pt4", label: "PT/Lab 4" },
  { id: "q1", label: "Quiz 1" },
  { id: "q2", label: "Quiz 2" },
  { id: "q3", label: "Quiz 3" },
  { id: "q4", label: "Quiz 4" },
  { id: "examScore", label: "Exam" },
];

export function PasteGradesDialog({
  onPaste,
  students,
  maxValues,
}: PasteGradesDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"column" | "student">("column");
  const [target, setTarget] = React.useState("");
  const [grades, setGrades] = React.useState("");
  const [error, setError] = React.useState("");

  const validateGrades = (inputGrades: string) => {
    setError("");
    const numbers = inputGrades.trim().split(/\s+/);

    // Check if all inputs are valid numbers
    if (!numbers.every((n) => /^\d+$/.test(n))) {
      setError("All grades must be valid numbers");
      return false;
    }

    if (type === "column") {
      if (numbers.length > students.length) {
        setError(`Maximum ${students.length} grades allowed for column paste`);
        return false;
      }
    } else {
      if (numbers.length > COLUMNS.length) {
        setError(`Maximum ${COLUMNS.length} grades allowed for student paste`);
        return false;
      }
    }

    return true;
  };

  const handlePaste = () => {
    if (!validateGrades(grades)) {
      toast.error(error);
      return;
    }

    onPaste(type, target, grades);
    setOpen(false);
    setGrades("");
    setError("");
  };

  const availableColumns = COLUMNS.filter((col) => {
    // Correctly map column id to maxValues property
    const maxValueKey = col.id === "examScore" ? "examMax" : col.id;
    // Type assertion to access dynamic property
    const maxValue = maxValues[maxValueKey as keyof typeof maxValues];
    return maxValue && maxValue !== "";
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="hover:bg-[#124A69]/10">
          Paste Grades
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border-[#124A69]/20">
        <DialogHeader>
          <DialogTitle className="text-[#124A69]">Paste Grades</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Select
            onValueChange={(val) => setType(val as "column" | "student")}
            value={type}
          >
            <SelectTrigger className="border-[#124A69]/20 focus:ring-[#124A69]/20">
              <SelectValue placeholder="Select paste type" />
            </SelectTrigger>
            <SelectContent className="border-[#124A69]/20">
              <SelectItem value="column" className="focus:bg-[#124A69]/10">
                By Column
              </SelectItem>
              <SelectItem value="student" className="focus:bg-[#124A69]/10">
                By Student
              </SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={setTarget} value={target}>
            <SelectTrigger className="border-[#124A69]/20 focus:ring-[#124A69]/20">
              <SelectValue
                placeholder={`Select ${
                  type === "column" ? "column" : "student"
                }`}
              />
            </SelectTrigger>
            <SelectContent className="border-[#124A69]/20">
              {type === "column"
                ? availableColumns.map((col) => (
                    <SelectItem
                      key={col.id}
                      value={col.id}
                      className="focus:bg-[#124A69]/10"
                    >
                      {col.label}
                    </SelectItem>
                  ))
                : students.map((student) => (
                    <SelectItem
                      key={student.id}
                      value={student.id}
                      className="focus:bg-[#124A69]/10"
                    >
                      {student.name}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>

          <div className="space-y-2">
            <Textarea
              placeholder={`Paste grades (space-separated numbers)\nMaximum ${
                type === "column" ? students.length : COLUMNS.length
              } grades`}
              value={grades}
              onChange={(e) => {
                setGrades(e.target.value);
                validateGrades(e.target.value);
              }}
              className={`border-[#124A69]/20 focus:ring-[#124A69]/20 ${
                error ? "border-red-500" : ""
              }`}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <Button
            onClick={handlePaste}
            disabled={!type || !target || !grades || !!error}
            className="bg-[#124A69] hover:bg-[#0D3A54] text-white disabled:bg-[#124A69]/50"
          >
            Apply Grades
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
