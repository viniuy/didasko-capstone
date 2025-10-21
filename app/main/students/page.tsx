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
import { Scan } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Student {
  uuid: string;
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

export default function StudentsPage() {
  // Simulate scanning RFID card
  const [uuid, setUuid] = React.useState("");
  const [isScanning, setIsScanning] = React.useState(false);
  const [hasScanned, setHasScanned] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<FormData>({
    lastName: "",
    firstName: "",
    middleInitial: "",
    studentImage: null,
    studentId: "",
  });
  const [student, setStudent] = React.useState<Student | null>(null);
  const rfidInputRef = React.useRef<HTMLInputElement>(null);
  const scanTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Handle scan button click
  const handleScan = () => {
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Reset everything first
    setUuid("");
    setStudent(null);
    setHasScanned(false);
    setIsEditing(false);
    setForm({
      lastName: "",
      firstName: "",
      middleInitial: "",
      studentImage: null,
      studentId: "",
    });

    setIsScanning(true);
    // Focus the hidden input to capture RFID input
    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  };

  // Handle cancel scan
  const handleCancelScan = () => {
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setIsScanning(false);
    setUuid("");

    // Clear the RFID input field
    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
  };

  // Handle RFID input from keyboard-based reader
  const handleRfidInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // If this is a new scan (input length is 1 and we weren't scanning), start fresh
    if (value.length === 1 && !isScanning) {
      setUuid(value);
      setIsScanning(true);
      return;
    }

    // If we're scanning, continue building the UID
    if (isScanning) {
      setUuid(value);

      // Check if we have a complete RFID UID (10 characters as per your update)
      if (value.length >= 10) {
        try {
          // Call the RFID API to check if student exists
          const response = await fetch("/api/students/rfid", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ rfidUid: value }),
          });

          const result = await response.json();

          if (result.found && result.student) {
            // Student found - convert to the format expected by the UI
            const foundStudent = {
              uuid: result.student.id, // Use the student's id as RFID UID
              lastName: result.student.lastName,
              firstName: result.student.firstName,
              middleInitial: result.student.middleInitial || "",
              studentImage: result.student.image,
              studentId: result.student.studentId,
            };
            setStudent(foundStudent);

            // Pre-fill the form with existing student data
            setForm({
              lastName: foundStudent.lastName,
              firstName: foundStudent.firstName,
              middleInitial: foundStudent.middleInitial,
              studentImage: null, // Clear image for editing
              studentId: foundStudent.studentId,
            });

            setHasScanned(true);
            setIsEditing(true); // Set to editing mode since student exists
          } else {
            // No student found
            setStudent(null);
            setHasScanned(true);
          }
        } catch (error) {
          console.error("Error scanning RFID:", error);
          setStudent(null);
          setHasScanned(true);
        }

        setIsScanning(false);

        // Clear the input field after processing the scan
        if (rfidInputRef.current) {
          rfidInputRef.current.value = "";
        }
      } else {
        // Set a timeout to reset scanning state if no more input comes in
        scanTimeoutRef.current = setTimeout(() => {
          setIsScanning(false);
          setUuid("");
          if (rfidInputRef.current) {
            rfidInputRef.current.value = "";
          }
        }, 1000); // 1 second timeout
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;

    if (files && files[0]) {
      // Handle image file
      const file = files[0];
      setForm((prev) => ({
        ...prev,
        [name]: file,
      }));
    } else {
      // Handle text input
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Handle image upload first if there's an image
      let imageUrl = null;
      if (form.studentImage) {
        // For now, we'll just use a placeholder. In a real app, you'd upload to a service like Cloudinary
        imageUrl = `data:${form.studentImage.type};base64,${await fileToBase64(
          form.studentImage
        )}`;
      } else if (isEditing && student && student.studentImage) {
        // Keep existing image if no new one is selected during editing
        imageUrl = student.studentImage;
      }

      // Create student data
      const studentData = {
        lastName: form.lastName,
        firstName: form.firstName,
        middleInitial: form.middleInitial || undefined,
        image: imageUrl,
        studentId: form.studentId,
        // Use the scanned RFID UID as the student's ID
        id: uuid,
      };

      // Call the students API
      let response;
      if (isEditing) {
        // Update existing student
        response = await fetch(`/api/students/${uuid}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(studentData),
        });
      } else {
        // Create new student
        response = await fetch("/api/students", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(studentData),
        });
      }

      if (response.ok) {
        const result = await response.json();
        const action = isEditing ? "updated" : "registered";
        console.log(`Student ${action} successfully:`, result);
        toast.success(`Student ${action} successfully!`);

        // Reset form and states
        setForm({
          lastName: "",
          firstName: "",
          middleInitial: "",
          studentImage: null,
          studentId: "",
        });
        setUuid("");
        setStudent(null);
        setHasScanned(false);
        setIsEditing(false);
      } else {
        const errorData = await response.json();
        const action = isEditing ? "updating" : "registering";
        toast.error(`Error ${action} student: ${errorData.error}`);
      }
    } catch (error) {
      const action = isEditing ? "updating" : "registering";
      console.error(`Error ${action} student:`, error);
      toast.error(`Failed to ${action} student. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === "string") {
          // Extract base64 part from data URL
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleNewScan = () => {
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setUuid("");
    setStudent(null);
    setHasScanned(false);
    setIsEditing(false);
    setForm({
      lastName: "",
      firstName: "",
      middleInitial: "",
      studentImage: null,
      studentId: "",
    });

    // Clear the RFID input field
    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AppSidebar />

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

          <div className="flex-1 overflow-y-auto pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {/* Scan RFID Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Scan RFID</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Hidden input for RFID reader */}
                  <input
                    ref={rfidInputRef}
                    type="text"
                    value={uuid}
                    onChange={handleRfidInput}
                    className="absolute -left-[9999px]"
                    placeholder="RFID input"
                  />

                  <div className="flex justify-center">
                    {isScanning ? (
                      <div className="flex gap-3">
                        <Button
                          onClick={handleCancelScan}
                          size="lg"
                          className="min-w-[120px] h-16 text-lg bg-gray-500 hover:bg-gray-600 text-white"
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled
                          size="lg"
                          className="min-w-[200px] h-16 text-lg bg-[#124A69] hover:bg-[#0a2f42] text-white"
                        >
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            Waiting for RFID...
                          </div>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleScan}
                        disabled={isSubmitting}
                        size="lg"
                        className="min-w-[200px] h-16 text-lg bg-[#124A69] hover:bg-[#0a2f42] text-white"
                      >
                        <Scan className="w-6 h-6 mr-3" />
                        Scan ID
                      </Button>
                    )}
                  </div>

                  {hasScanned && student ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-lg font-semibold mb-10">
                          Student Found
                        </h3>

                        {/* Show the pre-filled form for editing */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="studentId">Student ID </Label>
                            <Input
                              id="studentId"
                              name="studentId"
                              value={form.studentId}
                              onChange={handleChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              name="lastName"
                              value={form.lastName}
                              onChange={handleChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              name="firstName"
                              value={form.firstName}
                              onChange={handleChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="middleInitial">
                              Middle Initial
                            </Label>
                            <Input
                              id="middleInitial"
                              name="middleInitial"
                              value={form.middleInitial}
                              onChange={handleChange}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="studentImage">Student Image</Label>
                            <Input
                              id="studentImage"
                              type="file"
                              name="studentImage"
                              accept="image/*"
                              onChange={handleChange}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              className="flex-1 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  {isEditing ? "Updating..." : "Registering..."}
                                </div>
                              ) : isEditing ? (
                                "Update Student"
                              ) : (
                                "Register Student"
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleNewScan}
                              disabled={isSubmitting}
                              className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
                            >
                              Scan New ID
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : hasScanned && !student ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-lg font-semibold mb-3">
                          {isEditing ? "Edit Student" : "Register New Student"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {isEditing
                            ? `Editing student with RFID UID "${uuid}"`
                            : `RFID UID "${uuid}" is not registered. Please fill in the student details below.`}
                        </p>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="studentId">
                              Student ID <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="studentId"
                              name="studentId"
                              value={form.studentId}
                              onChange={handleChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">
                              Last Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="lastName"
                              name="lastName"
                              value={form.lastName}
                              onChange={handleChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="firstName">
                              First Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="firstName"
                              name="firstName"
                              value={form.firstName}
                              onChange={handleChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="middleInitial">
                              Middle Initial{" "}
                              <span className="text-gray-400">(optional)</span>
                            </Label>
                            <Input
                              id="middleInitial"
                              name="middleInitial"
                              value={form.middleInitial}
                              onChange={handleChange}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="studentImage">
                              Student Image{" "}
                              <span className="text-gray-400">(optional)</span>
                            </Label>
                            <Input
                              id="studentImage"
                              type="file"
                              name="studentImage"
                              accept="image/*"
                              onChange={handleChange}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              className="flex-1 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Registering...
                                </div>
                              ) : (
                                "Register Student"
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleNewScan}
                              disabled={isSubmitting}
                              className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
                            >
                              Scan New ID
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground text-center">
                        Click "Scan ID" to listen for RFID input and check if
                        the student is registered.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ID Preview Card */}
              <Card className="w-120">
                <CardHeader>
                  <CardTitle>ID Preview</CardTitle>
                </CardHeader>
                <CardContent className="w-120">
                  <div className="bg-white border-2 border-gray-300 rounded-lg shadow-sm overflow-hidden">
                    {/* Header with STI logo - yellow background */}
                    <div className="bg-[#FEF100] h-20 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-600 font-bold text-lg">
                          <img src={STI_logo.src} className="w-35" />
                        </span>
                      </div>
                    </div>

                    {/* Main blue body */}
                    <div className="bg-blue-800 p-6 relative">
                      <div className="text-[#FEF100] flex justify-center font-semibold text-lg mb-7 mt-2">
                        ALABANG
                      </div>
                      {/* Photo section - centered */}{" "}
                      <div className="flex justify-center mb-7">
                        <div className="w-70 h-70 bg-gray-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
                          {form.studentImage ? (
                            <img
                              src={URL.createObjectURL(form.studentImage)}
                              alt="Student Photo"
                              className="w-full h-full object-cover"
                            />
                          ) : student && student.studentImage ? (
                            <img
                              src={student.studentImage}
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
                      {/* Name information - centered */}
                      <div className="text-center mb-6">
                        <div className="text-white font-bold text-3xl mb-1 truncate px-2">
                          {form.lastName || "________"}
                        </div>
                        <div className="text-white text-lg truncate px-2">
                          {form.firstName || "________"} {form.middleInitial}{" "}
                          {form.middleInitial ? "." : ""}
                        </div>
                      </div>
                      {/* Bottom teal section with student number */}
                      <div className="bg-teal-500 rounded-lg p-3 text-center">
                        <div className="text-white font-semibold text-lg">
                          {form.studentId || "________"}
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
        {/* Right Sidebar */}
        <Rightsidebar />
      </main>
      <Toaster
        toastOptions={{
          className: "",
          style: {
            background: "#fff",
            color: "#124A69",
            border: "1px solid #e5e7eb",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: "0.5rem",
            padding: "1rem",
          },
          success: {
            style: {
              background: "#fff",
              color: "#124A69",
              border: "1px solid #e5e7eb",
            },
            iconTheme: {
              primary: "#124A69",
              secondary: "#fff",
            },
          },
          error: {
            style: {
              background: "#fff",
              color: "#dc2626",
              border: "1px solid #e5e7eb",
            },
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fff",
            },
          },
          loading: {
            style: {
              background: "#fff",
              color: "#124A69",
              border: "1px solid #e5e7eb",
            },
          },
        }}
      />
    </div>
  );
}
