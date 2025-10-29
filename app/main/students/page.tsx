"use client";
import React from "react";
import STI_logo from "@/public/stilogo.png";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Scan, Plus, Edit, Upload, Download } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";

interface Student {
  id: string;
  rfid_id: string | null;
  lastName: string;
  firstName: string;
  middleInitial: string;
  studentImage: string | null;
  studentId: string;
}

interface FormData {
  lastName: string;
  firstName: string;
  middleInitial: string;
  studentImage: File | null;
  studentId: string;
}

type ViewMode =
  | "idle"
  | "editing"
  | "creating"
  | "assigning-rfid"
  | "searching-rfid";

export default function StudentsPage() {
  // State management
  const [students, setStudents] = React.useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filteredStudents, setFilteredStudents] = React.useState<Student[]>([]);

  // Current view state
  const [viewMode, setViewMode] = React.useState<ViewMode>("idle");
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(
    null
  );

  // Form state
  const [formData, setFormData] = React.useState<FormData>({
    lastName: "",
    firstName: "",
    middleInitial: "",
    studentImage: null,
    studentId: "",
  });

  // RFID scanning state
  const [isScanning, setIsScanning] = React.useState(false);
  const [scannedRfid, setScannedRfid] = React.useState("");

  // Loading state
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Import dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importPreview, setImportPreview] = React.useState<any[]>([]);

  // Refs
  const rfidInputRef = React.useRef<HTMLInputElement>(null);
  const scanTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch students on mount
  React.useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search
  React.useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStudents(students);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = students.filter(
        (s) =>
          s.firstName.toLowerCase().includes(query) ||
          s.lastName.toLowerCase().includes(query) ||
          s.studentId.toLowerCase().includes(query) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(query)
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  // Fetch all students from API
  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/students");
      if (response.ok) {
        const data = await response.json();
        const studentList = Array.isArray(data) ? data : data.students || [];

        const mappedStudents: Student[] = studentList.map((s: any) => ({
          id: s.id,
          rfid_id: s.rfid_id || null,
          lastName: s.lastName,
          firstName: s.firstName,
          middleInitial: s.middleInitial || "",
          studentImage: s.image,
          studentId: s.studentId,
        }));

        setStudents(mappedStudents);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    }
  };

  // Reset to idle state
  const resetToIdle = () => {
    setViewMode("idle");
    setSelectedStudent(null);
    setFormData({
      lastName: "",
      firstName: "",
      middleInitial: "",
      studentImage: null,
      studentId: "",
    });
    setScannedRfid("");
    setIsScanning(false);
    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  // Handle student selection from list
  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setViewMode("editing");
    setFormData({
      lastName: student.lastName,
      firstName: student.firstName,
      middleInitial: student.middleInitial,
      studentImage: null, // We'll show existing image separately
      studentId: student.studentId,
    });
    setScannedRfid("");
    setIsScanning(false);
  };

  // Handle "Add Student" button
  const handleAddNewStudent = () => {
    setViewMode("creating");
    setSelectedStudent(null);
    setFormData({
      lastName: "",
      firstName: "",
      middleInitial: "",
      studentImage: null,
      studentId: "",
    });
    setScannedRfid("");
    setIsScanning(false);
  };

  // Handle "Search via RFID" button
  const handleSearchViaRfid = () => {
    setViewMode("searching-rfid");
    setSelectedStudent(null);
    setIsScanning(true);
    setScannedRfid("");

    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  };

  // Handle export template
  const handleExportTemplate = () => {
    const template = [
      ["Student ID", "Last Name", "First Name", "Middle Initial"],
      ["2021-00001", "Dela Cruz", "Juan", "A"],
      ["2021-00002", "Santos", "Maria", "B"],
    ];

    const csvContent = template.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Template downloaded successfully!");
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    setImportFile(file);

    // Parse CSV for preview
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0].split(",");

    const preview = lines.slice(1, 6).map((line) => {
      const values = line.split(",");
      return {
        studentId: values[0]?.trim() || "",
        lastName: values[1]?.trim() || "",
        firstName: values[2]?.trim() || "",
        middleInitial: values[3]?.trim() || "",
      };
    });

    setImportPreview(preview);
  };

  // Handle import students
  const handleImportStudents = async () => {
    if (!importFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsSubmitting(true);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const dataLines = lines.slice(1); // Skip header

      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        const values = line.split(",");
        const studentData = {
          studentId: values[0]?.trim(),
          lastName: values[1]?.trim(),
          firstName: values[2]?.trim(),
          middleInitial: values[3]?.trim() || undefined,
        };

        if (
          !studentData.studentId ||
          !studentData.lastName ||
          !studentData.firstName
        ) {
          errorCount++;
          continue;
        }

        try {
          const response = await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(studentData),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      toast.success(`Imported ${successCount} students successfully!`);
      if (errorCount > 0) {
        toast.error(`${errorCount} students failed to import`);
      }

      await fetchStudents();
      setIsImportDialogOpen(false);
      setImportFile(null);
      setImportPreview([]);
    } catch (error) {
      console.error("Error importing students:", error);
      toast.error("Failed to import students");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle "Assign RFID" button
  const handleStartRfidScan = () => {
    if (!selectedStudent) return;

    setViewMode("assigning-rfid");
    setIsScanning(true);
    setScannedRfid("");

    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  };

  // Handle cancel RFID scan
  const handleCancelRfidScan = () => {
    setIsScanning(false);
    setScannedRfid("");
    setViewMode("editing");

    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  // Handle RFID input
  const handleRfidInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setScannedRfid(value);

    // Wait for complete RFID (at least 10 characters)
    if (value.length >= 10) {
      // Check if RFID is already assigned
      const existingStudent = students.find(
        (s) => s.rfid_id && String(s.rfid_id) === value
      );

      if (existingStudent) {
        // If we're searching via RFID, load the student
        if (viewMode === "searching-rfid") {
          toast.success(
            `Found student: ${existingStudent.firstName} ${existingStudent.lastName}`,
            { duration: 3000 }
          );
          handleSelectStudent(existingStudent);
          setScannedRfid("");
          setIsScanning(false);
          if (rfidInputRef.current) rfidInputRef.current.value = "";
          return;
        }

        // If we're assigning RFID, show error
        toast.error(
          `RFID "${value}" is already assigned to ${existingStudent.firstName} ${existingStudent.lastName}`,
          { duration: 3000 }
        );
        setScannedRfid("");
        setIsScanning(false);
        if (rfidInputRef.current) rfidInputRef.current.value = "";
        return;
      }

      // If searching and no student found
      if (viewMode === "searching-rfid") {
        toast.error(`No student found with RFID "${value}"`, {
          duration: 3000,
        });
        setScannedRfid("");
        setIsScanning(false);
        if (rfidInputRef.current) rfidInputRef.current.value = "";
        return;
      }

      // Valid RFID scanned for assignment
      toast.success(`RFID "${value}" scanned successfully!`);
      setIsScanning(false);
    } else {
      // Reset timeout if input stops
      scanTimeoutRef.current = setTimeout(() => {
        if (value.length > 0 && value.length < 10) {
          toast.error("Incomplete RFID scan. Please try again.");
        }
        setScannedRfid("");
        if (rfidInputRef.current) {
          rfidInputRef.current.value = "";
        }
      }, 1000);
    }
  };

  // Handle form input changes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;

    if (files && files[0]) {
      setFormData((prev) => ({
        ...prev,
        [name]: files[0],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle form submission (create or update student)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prepare image URL
      let imageUrl = null;
      if (formData.studentImage) {
        imageUrl = `data:${
          formData.studentImage.type
        };base64,${await fileToBase64(formData.studentImage)}`;
      } else if (selectedStudent?.studentImage) {
        imageUrl = selectedStudent.studentImage;
      }

      const studentData = {
        lastName: formData.lastName,
        firstName: formData.firstName,
        middleInitial: formData.middleInitial || undefined,
        image: imageUrl,
        studentId: formData.studentId,
        rfid_id: scannedRfid || selectedStudent?.rfid_id || undefined,
      };

      let response;
      if (viewMode === "editing" && selectedStudent?.id) {
        // Update existing student
        response = await fetch(`/api/students/${selectedStudent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(studentData),
        });
      } else {
        // Create new student
        response = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(studentData),
        });
      }

      if (response.ok) {
        const result = await response.json();
        const action = viewMode === "editing" ? "updated" : "created";
        toast.success(`Student ${action} successfully!`);

        await fetchStudents();
        resetToIdle();
      } else {
        const errorData = await response.json();
        toast.error(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error submitting student:", error);
      toast.error("Failed to save student. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle RFID assignment only
  const handleAssignRfidOnly = async () => {
    if (!selectedStudent || !scannedRfid) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/students/rfid/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfid: parseInt(scannedRfid, 10),
          studentId: selectedStudent.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign RFID");
      }

      toast.success(`RFID assigned successfully!`);
      await fetchStudents();
      resetToIdle();
    } catch (error: any) {
      console.error("Error assigning RFID:", error);
      toast.error(error.message || "Failed to assign RFID");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the form section based on current mode
  const renderFormSection = () => {
    if (viewMode === "idle") {
      return (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Select a student from the directory to edit, or click "Add Student"
            to create a new one.
          </p>
        </div>
      );
    }

    if (viewMode === "searching-rfid") {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">
              Search Student via RFID
            </h3>

            <div className="flex justify-center gap-3 mb-4">
              {isScanning ? (
                <>
                  <Button
                    onClick={resetToIdle}
                    size="lg"
                    variant="outline"
                    className="min-w-[120px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled
                    size="lg"
                    className="min-w-[200px] bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  >
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Scanning RFID...
                    </div>
                  </Button>
                </>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Please scan the RFID card to search for the student.
            </p>
          </div>
        </div>
      );
    }

    const isEditingExisting = viewMode === "editing";
    const isAssigningRfid = viewMode === "assigning-rfid";
    const hasRfid = selectedStudent?.rfid_id || scannedRfid;

    return (
      <div className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isAssigningRfid
                ? `Assign RFID to ${selectedStudent?.firstName}`
                : isEditingExisting
                ? "Edit Student"
                : "Add New Student"}
            </h3>
            {isEditingExisting && !isAssigningRfid && (
              <Button
                onClick={handleStartRfidScan}
                size="sm"
                variant={hasRfid ? "outline" : "default"}
                className={
                  hasRfid
                    ? "border-orange-500 text-orange-600 hover:bg-orange-50"
                    : "bg-[#124A69] hover:bg-[#0a2f42] text-white"
                }
              >
                <Scan className="w-4 h-4 mr-2" />
                {hasRfid ? "Change RFID" : "Assign RFID"}
              </Button>
            )}
          </div>

          {isAssigningRfid && (
            <div className="mb-4 space-y-3">
              <div className="flex justify-center gap-3">
                {isScanning ? (
                  <>
                    <Button
                      onClick={handleCancelRfidScan}
                      size="lg"
                      variant="outline"
                      className="min-w-[120px]"
                    >
                      Cancel Scan
                    </Button>
                    <Button
                      disabled
                      size="lg"
                      className="min-w-[200px] bg-[#124A69] hover:bg-[#0a2f42] text-white"
                    >
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Waiting for RFID...
                      </div>
                    </Button>
                  </>
                ) : scannedRfid ? (
                  <div className="w-full p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 text-center">
                      ✓ RFID scanned:{" "}
                      <span className="font-mono font-semibold">
                        {scannedRfid}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>

              {scannedRfid && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleAssignRfidOnly}
                    className="flex-1 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Assigning...
                      </div>
                    ) : (
                      "Confirm RFID Assignment"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelRfidScan}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isAssigningRfid && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studentId">
                  Student ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="studentId"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleFormChange}
                  required
                  maxLength={20}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleFormChange}
                  required
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleFormChange}
                  required
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="middleInitial">Middle Initial</Label>
                <Input
                  id="middleInitial"
                  name="middleInitial"
                  value={formData.middleInitial}
                  onChange={handleFormChange}
                  maxLength={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentImage">Student Image</Label>
                <Input
                  id="studentImage"
                  type="file"
                  name="studentImage"
                  accept="image/*"
                  onChange={handleFormChange}
                />
                {selectedStudent?.studentImage && !formData.studentImage && (
                  <p className="text-xs text-muted-foreground">
                    Current image will be kept if no new image is uploaded
                  </p>
                )}
              </div>

              {selectedStudent?.rfid_id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Current RFID:{" "}
                    <span className="font-mono font-semibold">
                      {selectedStudent.rfid_id}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {isEditingExisting ? "Updating..." : "Creating..."}
                    </div>
                  ) : (
                    <>
                      {isEditingExisting ? "Update Student" : "Create Student"}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetToIdle}
                  disabled={isSubmitting}
                  className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  // Get display image for preview
  const getPreviewImage = () => {
    if (formData.studentImage instanceof File) {
      return URL.createObjectURL(formData.studentImage);
    }
    if (selectedStudent?.studentImage) {
      return selectedStudent.studentImage;
    }
    return null;
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppSidebar />

      {/* Hidden RFID input */}
      <input
        ref={rfidInputRef}
        type="text"
        onChange={handleRfidInput}
        className="absolute -left-[9999px]"
        placeholder="RFID input"
      />

      <main className="h-full w-full lg:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all">
        <div className="flex flex-col flex-grow px-4">
          <Header />

          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
              Student Management
            </h1>
            <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
              {format(new Date(), "EEEE, MMMM d")}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto pb-6 ">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {/* Student Directory */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Student Directory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search Students</Label>
                    <Input
                      id="search"
                      placeholder="Search by name or student ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <Button
                    onClick={handleAddNewStudent}
                    className="w-full bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Student
                  </Button>

                  <Button
                    onClick={handleSearchViaRfid}
                    variant="outline"
                    className="w-full border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Search via RFID
                  </Button>

                  <Dialog
                    open={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Students
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Import Students</DialogTitle>
                        <DialogDescription>
                          Download the template, fill it with student data, and
                          upload it back.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Button
                            onClick={handleExportTemplate}
                            variant="outline"
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export Template
                          </Button>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                            className="flex-1"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Select File
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </div>

                        {importFile && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              Selected:{" "}
                              <span className="font-semibold">
                                {importFile.name}
                              </span>
                            </p>
                          </div>
                        )}

                        {importPreview.length > 0 && (
                          <div className="space-y-2">
                            <Label>Preview (First 5 rows)</Label>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="px-3 py-2 text-left">
                                      Student ID
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      Last Name
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      First Name
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                      Middle Initial
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {importPreview.map((row, idx) => (
                                    <tr key={idx} className="border-t">
                                      <td className="px-3 py-2">
                                        {row.studentId}
                                      </td>
                                      <td className="px-3 py-2">
                                        {row.lastName}
                                      </td>
                                      <td className="px-3 py-2">
                                        {row.firstName}
                                      </td>
                                      <td className="px-3 py-2">
                                        {row.middleInitial}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={handleImportStudents}
                            disabled={!importFile || isSubmitting}
                            className="flex-1 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                          >
                            {isSubmitting ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Importing...
                              </div>
                            ) : (
                              "Import Students"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsImportDialogOpen(false);
                              setImportFile(null);
                              setImportPreview([]);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <div
                          key={student.id}
                          className={`p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                            selectedStudent?.id === student.id
                              ? "bg-muted border-[#124A69]"
                              : ""
                          }`}
                          onClick={() => handleSelectStudent(student)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold">
                                {student.lastName}, {student.firstName}{" "}
                                {student.middleInitial}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ID: {student.studentId}
                              </p>
                              {student.rfid_id ? (
                                <p className="text-xs text-green-600 mt-1">
                                  ✓ RFID: {student.rfid_id}
                                </p>
                              ) : (
                                <p className="text-xs text-orange-600 mt-1">
                                  ⚠ No RFID
                                </p>
                              )}
                            </div>
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No students found
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Form Section */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Student Details</CardTitle>
                </CardHeader>
                <CardContent>{renderFormSection()}</CardContent>
              </Card>

              {/* ID Preview */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>ID Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white border-2 border-gray-300 rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-[#FEF100] h-20 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-2">
                        <img
                          src={STI_logo.src}
                          className="w-35"
                          alt="STI Logo"
                        />
                      </div>
                    </div>

                    <div className="bg-blue-800 p-6 relative">
                      <div className="text-[#FEF100] flex justify-center font-semibold text-lg mb-7 mt-2">
                        ALABANG
                      </div>
                      <div className="flex justify-center mb-7">
                        <div className="w-70 h-70 bg-gray-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
                          {getPreviewImage() ? (
                            <img
                              src={getPreviewImage()!}
                              alt="Student Photo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-gray-500 text-center">
                              No Photo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-center mb-6">
                        <div className="text-white font-bold text-3xl mb-1 truncate px-2">
                          {formData.lastName || "________"}
                        </div>
                        <div className="text-white text-lg truncate px-2">
                          {formData.firstName || "________"}{" "}
                          {formData.middleInitial}
                          {formData.middleInitial ? "." : ""}
                        </div>
                      </div>
                      <div className="bg-teal-500 rounded-lg p-3 text-center">
                        <div className="text-white font-semibold text-lg">
                          {formData.studentId || "________"}
                        </div>
                        <div className="text-white text-xs opacity-90">
                          Student Number
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <Rightsidebar />
      </main>
    </div>
  );
}
