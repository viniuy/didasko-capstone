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
import toast from "react-hot-toast";

interface Student {
  uuid: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  studentImage: string | null;
  studentId: string;
  id?: string;
  rfid_id?: string | null;
}

interface FormData {
  lastName: string;
  firstName: string;
  middleInitial: string;
  studentImage: File | null;
  studentId: string;
}

export default function StudentsPage() {
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
  const [students, setStudents] = React.useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filteredStudents, setFilteredStudents] = React.useState<Student[]>([]);
  const [showAddManual, setShowAddManual] = React.useState(false);
  const [selectedStudentForRfid, setSelectedStudentForRfid] =
    React.useState<Student | null>(null);
  const rfidInputRef = React.useRef<HTMLInputElement>(null);
  const scanTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    fetchStudents();
  }, []);

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

  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/students");
      if (response.ok) {
        const data = await response.json();

        // Check if data is an array, if not handle it appropriately
        if (Array.isArray(data)) {
          const mappedStudents = data.map((s: any) => ({
            uuid: s.rfid_id || s.id,
            id: s.id,
            rfid_id: s.rfid_id,
            lastName: s.lastName,
            firstName: s.firstName,
            middleInitial: s.middleInitial || "",
            studentImage: s.image,
            studentId: s.studentId,
          }));
          setStudents(mappedStudents);
        } else if (data && data.students && Array.isArray(data.students)) {
          // If the API returns {students: [...]}
          const mappedStudents = data.students.map((s: any) => ({
            uuid: s.rfid_id || s.id,
            id: s.id,
            rfid_id: s.rfid_id,
            lastName: s.lastName,
            firstName: s.firstName,
            middleInitial: s.middleInitial || "",
            studentImage: s.image,
            studentId: s.studentId,
          }));
          setStudents(mappedStudents);
        } else {
          console.error("Unexpected data format:", data);
          setStudents([]);
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
      setStudents([]);
    }
  };

  const handleScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setUuid("");
    if (!selectedStudentForRfid) {
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
    }

    setIsScanning(true);
    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  };

  const handleCancelScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setIsScanning(false);
    setUuid("");

    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
  };

  const handleRfidInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    if (value.length === 1 && !isScanning) {
      setUuid(value);
      setIsScanning(true);
      return;
    }

    if (isScanning) {
      setUuid(value);

      if (value.length >= 10) {
        // If we're assigning RFID to a selected student
        if (selectedStudentForRfid) {
          const loadingToast = toast.loading(
            `Assigning RFID "${value}" to ${selectedStudentForRfid.firstName} ${selectedStudentForRfid.lastName}...`
          );

          setTimeout(async () => {
            try {
              const res = await fetch("/api/students/rfid/assign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  rfid: parseInt(value, 10),
                  studentId: selectedStudentForRfid.id,
                }),
              });

              const data = await res.json();
              toast.dismiss(loadingToast);

              if (!res.ok)
                throw new Error(data.error || "Failed to assign RFID");

              setSelectedStudentForRfid((prev) =>
                prev ? { ...prev, rfid_id: String(value) } : prev
              );
              setStudents((prevStudents) =>
                prevStudents.map((s) =>
                  s.id === selectedStudentForRfid.id
                    ? { ...s, rfid_id: String(value) }
                    : s
                )
              );
              toast.success(
                `RFID "${value}" successfully assigned to ${selectedStudentForRfid.firstName}!`,
                { duration: 3000 }
              );

              setUuid(value);
              setHasScanned(true);
            } catch (err: any) {
              toast.dismiss(loadingToast);
              toast.error(err.message || "Something went wrong.", {
                duration: 3000,
              });
            } finally {
              setIsScanning(false);
              if (rfidInputRef.current) rfidInputRef.current.value = "";
            }
          }, 2000);

          return;
        }

        setIsScanning(false);

        if (rfidInputRef.current) {
          rfidInputRef.current.value = "";
        }
      } else {
        scanTimeoutRef.current = setTimeout(() => {
          setIsScanning(false);
          setUuid("");
          if (rfidInputRef.current) {
            rfidInputRef.current.value = "";
          }
        }, 1000);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;

    if (files && files[0]) {
      const file = files[0];
      setForm((prev) => ({
        ...prev,
        [name]: file,
      }));
    } else {
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
      let imageUrl = null;
      if (form.studentImage) {
        imageUrl = `data:${form.studentImage.type};base64,${await fileToBase64(
          form.studentImage
        )}`;
      } else if (isEditing && student && student.studentImage) {
        imageUrl = student.studentImage;
      }

      const studentData = {
        lastName: form.lastName,
        firstName: form.firstName,
        middleInitial: form.middleInitial || undefined,
        image: imageUrl,
        studentId: form.studentId,
        rfid_id: uuid || undefined,
      };

      let response;
      if (isEditing && student?.id) {
        response = await fetch(`/api/students/${student.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(studentData),
        });
      } else {
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

        await fetchStudents();

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
        setShowAddManual(false);
        setSelectedStudentForRfid(null);
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

  const handleNewScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setUuid("");
    setStudent(null);
    setHasScanned(false);
    setIsEditing(false);
    setShowAddManual(false);
    setSelectedStudentForRfid(null);
    setForm({
      lastName: "",
      firstName: "",
      middleInitial: "",
      studentImage: null,
      studentId: "",
    });

    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
  };

  const handleSelectStudentForRfid = (selectedStudent: Student) => {
    setSelectedStudentForRfid(selectedStudent);
    setStudent(selectedStudent);
    setIsEditing(true);
    setForm({
      lastName: selectedStudent.lastName,
      firstName: selectedStudent.firstName,
      middleInitial: selectedStudent.middleInitial,
      studentImage: null,
      studentId: selectedStudent.studentId,
    });
    setShowAddManual(false);
    handleScan();
  };

  const handleAddManualStudent = () => {
    setShowAddManual(true);
    setHasScanned(true);
    setStudent(null);
    setIsEditing(false);
    setSelectedStudentForRfid(null);
    setForm({
      lastName: "",
      firstName: "",
      middleInitial: "",
      studentImage: null,
      studentId: "",
    });
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
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
                    />
                  </div>

                  <Button
                    onClick={handleAddManualStudent}
                    className="w-full bg-[#124A69] hover:bg-[#0a2f42] text-white"
                  >
                    Add Student (No RFID)
                  </Button>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((s) => (
                        <div
                          key={s.id || s.uuid}
                          className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleSelectStudentForRfid(s)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold">
                                {s.lastName}, {s.firstName} {s.middleInitial}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ID: {s.studentId}
                              </p>
                              {s.rfid_id ? (
                                <p className="text-xs text-green-600 mt-1">
                                  ✓ RFID Assigned
                                </p>
                              ) : (
                                <p className="text-xs text-orange-600 mt-1">
                                  ⚠ No RFID
                                </p>
                              )}
                            </div>
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

              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>
                    {selectedStudentForRfid
                      ? `Assign RFID to ${selectedStudentForRfid.firstName} ${selectedStudentForRfid.lastName}`
                      : "Scan RFID"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
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
                          {selectedStudentForRfid
                            ? "Assign RFID"
                            : "Student Found"}
                        </h3>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="studentId">Student ID</Label>
                            <Input
                              id="studentId"
                              name="studentId"
                              value={form.studentId}
                              onChange={handleChange}
                              required
                              disabled={selectedStudentForRfid !== null}
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
                              disabled={selectedStudentForRfid !== null}
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
                              disabled={selectedStudentForRfid !== null}
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
                              disabled={selectedStudentForRfid !== null}
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

                          {selectedStudentForRfid && uuid && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-sm text-green-800">
                                ✓ RFID scanned:{" "}
                                <span className="font-mono">{uuid}</span>
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              onClick={handleSubmit}
                              className="flex-1 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                              disabled={
                                isSubmitting ||
                                (selectedStudentForRfid !== null && !uuid)
                              }
                            >
                              {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  {selectedStudentForRfid
                                    ? "Assigning RFID..."
                                    : isEditing
                                    ? "Updating..."
                                    : "Registering..."}
                                </div>
                              ) : selectedStudentForRfid ? (
                                "Assign RFID"
                              ) : isEditing ? (
                                "Update Student"
                              ) : (
                                "Register Student"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleNewScan}
                              disabled={isSubmitting}
                              className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : hasScanned && !student ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-lg font-semibold mb-3">
                          {showAddManual
                            ? "Add New Student"
                            : isEditing
                            ? "Edit Student"
                            : "Register New Student"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {showAddManual
                            ? "Fill in the student details. RFID can be assigned later."
                            : isEditing
                            ? `Editing student with RFID UID "${uuid}"`
                            : `RFID UID "${uuid}" is not registered. Please fill in the student details below.`}
                        </p>
                        <div className="space-y-4">
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
                              onClick={handleSubmit}
                              className="flex-1 bg-[#124A69] hover:bg-[#0a2f42] text-white"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  {showAddManual
                                    ? "Adding..."
                                    : "Registering..."}
                                </div>
                              ) : showAddManual ? (
                                "Add Student"
                              ) : (
                                "Register Student"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleNewScan}
                              disabled={isSubmitting}
                              className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground text-center">
                        {selectedStudentForRfid
                          ? `Click "Scan ID" to assign an RFID to ${selectedStudentForRfid.firstName} ${selectedStudentForRfid.lastName}`
                          : 'Click "Scan ID" to listen for RFID input and check if the student is registered.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="w-120 lg:col-span-1">
                <CardHeader>
                  <CardTitle>ID Preview</CardTitle>
                </CardHeader>
                <CardContent className="w-120">
                  <div className="bg-white border-2 border-gray-300 rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-[#FEF100] h-20 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-600 font-bold text-lg">
                          <img src={STI_logo.src} className="w-35" />
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-800 p-6 relative">
                      <div className="text-[#FEF100] flex justify-center font-semibold text-lg mb-7 mt-2">
                        ALABANG
                      </div>
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
                      <div className="text-center mb-6">
                        <div className="text-white font-bold text-3xl mb-1 truncate px-2">
                          {form.lastName || "________"}
                        </div>
                        <div className="text-white text-lg truncate px-2">
                          {form.firstName || "________"} {form.middleInitial}{" "}
                          {form.middleInitial ? "." : ""}
                        </div>
                      </div>
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
        <Rightsidebar />
      </main>
    </div>
  );
}
