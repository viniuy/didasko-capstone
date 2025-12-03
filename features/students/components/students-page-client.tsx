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
import { studentsService } from "@/lib/services/client";
import { useStudents } from "@/lib/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/queries/queryKeys";
import { useRouter, useSearchParams } from "next/navigation";

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

interface StudentsPageClientProps {
  initialStudents: Student[];
  initialPagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialSearch?: string;
}

export function StudentsPageClient({
  initialStudents,
  initialPagination,
  initialSearch,
}: StudentsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [searchQuery, setSearchQuery] = React.useState(initialSearch || "");
  const [currentPage, setCurrentPage] = React.useState(
    Number(searchParams.get("page")) || 1
  );
  const [limit, setLimit] = React.useState(50);
  const [windowHeight, setWindowHeight] = React.useState(
    typeof window !== "undefined" ? window.innerHeight : 1000
  );

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
  const rfidScanContainerRef = React.useRef<HTMLDivElement>(null);
  const lastRfidInputTimeRef = React.useRef<number>(0);
  const rfidInputBufferRef = React.useRef<string>("");

  // Load all students initially (no search filter - we'll filter locally)
  const { data: studentsData, isLoading } = useStudents({
    filters: {
      page: 1,
      limit: 1000, // Load a large batch initially
      // No search filter - we'll filter locally
    },
    initialData: {
      students: initialStudents,
      pagination: initialPagination || {
        total: initialStudents.length,
        page: 1,
        limit: 1000,
        totalPages: 1,
      },
    },
    refetchOnMount: false, // Don't refetch if we have data
    refetchOnWindowFocus: false,
  });

  // Extract all students from query data
  const allStudents = React.useMemo(() => {
    if (!studentsData) return initialStudents;
    const studentList = Array.isArray(studentsData)
      ? studentsData
      : studentsData.students || [];
    return studentList.map((s: any) => ({
      id: s.id,
      rfid_id: s.rfid_id ? String(s.rfid_id) : null,
      lastName: s.lastName,
      firstName: s.firstName,
      middleInitial: s.middleInitial || "",
      studentImage: s.image,
      studentId: s.studentId,
    }));
  }, [studentsData, initialStudents]);

  // Filter students locally based on search query and apply pagination
  const students = React.useMemo(() => {
    let filtered = allStudents;

    // Apply local search filter if search query exists
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = allStudents.filter((student: Student) => {
        const fullName = `${student.firstName} ${student.lastName} ${
          student.middleInitial || ""
        }`.toLowerCase();
        const lastNameFirst =
          `${student.lastName}, ${student.firstName}`.toLowerCase();
        const studentId = student.studentId?.toLowerCase() || "";
        const rfidId = student.rfid_id?.toString().toLowerCase() || "";

        return (
          fullName.includes(query) ||
          lastNameFirst.includes(query) ||
          studentId.includes(query) ||
          rfidId.includes(query)
        );
      });
    }

    // Apply pagination to filtered results
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    return filtered.slice(startIndex, endIndex);
  }, [allStudents, searchQuery, currentPage, limit]);

  // Calculate pagination based on filtered results
  const pagination = React.useMemo(() => {
    let totalStudents = allStudents.length;

    // If searching, count filtered students
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      totalStudents = allStudents.filter((student: Student) => {
        const fullName = `${student.firstName} ${student.lastName} ${
          student.middleInitial || ""
        }`.toLowerCase();
        const lastNameFirst =
          `${student.lastName}, ${student.firstName}`.toLowerCase();
        const studentId = student.studentId?.toLowerCase() || "";
        const rfidId = student.rfid_id?.toString().toLowerCase() || "";

        return (
          fullName.includes(query) ||
          lastNameFirst.includes(query) ||
          studentId.includes(query) ||
          rfidId.includes(query)
        );
      }).length;
    }

    return {
      total: totalStudents,
      page: currentPage,
      limit,
      totalPages: Math.ceil(totalStudents / limit),
    };
  }, [allStudents, searchQuery, currentPage, limit]);

  // Adjust limit based on window height for low viewport laptops (max 30)
  React.useEffect(() => {
    const updateLimit = () => {
      const height = window.innerHeight;
      setWindowHeight(height);
      const newLimit = height < 930 ? 30 : 50;
      setLimit((prevLimit) => {
        if (prevLimit !== newLimit) {
          // Reset to page 1 when limit changes
          const params = new URLSearchParams(window.location.search);
          params.set("page", "1");
          router.push(`/main/students?${params.toString()}`);
          return newLimit;
        }
        return prevLimit;
      });
    };

    // Set initial value
    updateLimit();

    // Listen for resize events
    window.addEventListener("resize", updateLimit);

    return () => {
      window.removeEventListener("resize", updateLimit);
    };
  }, [router]);

  // Handle click outside RFID scan area
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isScanning &&
        rfidScanContainerRef.current &&
        !rfidScanContainerRef.current.contains(event.target as Node) &&
        !rfidInputRef.current?.contains(event.target as Node)
      ) {
        setIsScanning(false);
        if (rfidInputRef.current) {
          rfidInputRef.current.value = "";
        }
      }
    };

    if (isScanning) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isScanning]);

  // Handle search with debounce and navigation
  // Handle page navigation (local state only, no URL update)
  const handlePageChange = React.useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  const queryClient = useQueryClient();

  // Search optimization constants
  const MIN_SEARCH_LENGTH = 2; // Require at least 2 characters
  const SEARCH_DEBOUNCE_MS = 800; // Increased debounce time

  // Local storage cache for recently viewed students
  const CACHE_KEY = "recent_students";
  const MAX_CACHED = 100;

  // Helper function to cache recently viewed students
  const cacheStudent = React.useCallback((student: Student) => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const recentStudents: Student[] = cached ? JSON.parse(cached) : [];

      // Remove if already exists
      const filtered = recentStudents.filter((s) => s.id !== student.id);
      // Add to front
      filtered.unshift(student);
      // Keep only last MAX_CACHED
      const toCache = filtered.slice(0, MAX_CACHED);

      localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Helper function to get cached students
  const getCachedStudents = React.useCallback((): Student[] => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }, []);

  // Prefetch next page when current page loads
  React.useEffect(() => {
    if (studentsData && pagination && currentPage < pagination.totalPages) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.students.list({
          page: currentPage + 1,
          limit,
          search: searchQuery || undefined,
        }),
        queryFn: async () => {
          return await studentsService.getStudents({
            page: currentPage + 1,
            limit,
            search: searchQuery || undefined,
          });
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      });
    }
  }, [currentPage, limit, searchQuery, pagination, queryClient, studentsData]);

  // Helper function to truncate student names for toast messages
  const truncateName = (
    firstName: string,
    lastName: string,
    maxLength: number = 25
  ): string => {
    const fullName = `${firstName} ${lastName}`;
    if (fullName.length <= maxLength) return fullName;
    return `${fullName.substring(0, maxLength - 3)}...`;
  };

  // Helper function to show error toast (ensures only one error at a time)
  const showErrorToast = (message: string, options?: { duration?: number }) => {
    toast.dismiss(); // Dismiss all existing toasts
    toast.error(message, { duration: options?.duration || 3000 });
  };

  // Helper function to show success toast
  const showSuccessToast = (
    message: string,
    options?: { duration?: number }
  ) => {
    toast.success(message, { duration: options?.duration || 3000 });
  };

  // Fetch all students from API (for refetch after mutations)
  const fetchStudents = async () => {
    try {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.students.lists() });
    } catch (error) {
      console.error("Error fetching students:", error);
      showErrorToast("Failed to load students");
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
    lastRfidInputTimeRef.current = 0;
    rfidInputBufferRef.current = "";
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
    lastRfidInputTimeRef.current = 0;
    rfidInputBufferRef.current = "";

    // Cache the student for quick access
    cacheStudent(student);
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
    lastRfidInputTimeRef.current = 0;
    rfidInputBufferRef.current = "";
    // Focus on hidden RFID input if user wants to scan
    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
  };

  // Handle "Search via RFID" button
  const handleSearchViaRfid = () => {
    setViewMode("searching-rfid");
    setSelectedStudent(null);
    setIsScanning(true);
    setScannedRfid("");
    lastRfidInputTimeRef.current = 0;
    rfidInputBufferRef.current = "";

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
      showErrorToast("Please select a CSV file");
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
      showErrorToast("Please select a file first");
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
          await studentsService.create(studentData);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      showSuccessToast(`Imported ${successCount} students successfully!`);
      if (errorCount > 0) {
        showErrorToast(`${errorCount} students failed to import`);
      }

      await fetchStudents();
      setIsImportDialogOpen(false);
      setImportFile(null);
      setImportPreview([]);
    } catch (error) {
      console.error("Error importing students:", error);
      showErrorToast("Failed to import students");
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
    lastRfidInputTimeRef.current = 0;
    rfidInputBufferRef.current = "";

    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  };

  // Handle cancel RFID scan
  const handleCancelRfidScan = () => {
    setIsScanning(false);
    setScannedRfid("");
    setViewMode("editing");
    lastRfidInputTimeRef.current = 0;
    rfidInputBufferRef.current = "";

    if (rfidInputRef.current) {
      rfidInputRef.current.value = "";
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  // Handle RFID input - only accept rapid scans (RFID scanner), not manual typing
  const handleRfidInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentTime = Date.now();
    const timeSinceLastInput = currentTime - lastRfidInputTimeRef.current;

    // If there's a delay > 400ms between characters, it's likely manual typing - reject it
    if (lastRfidInputTimeRef.current > 0 && timeSinceLastInput > 400) {
      // Reset - this is manual typing, not RFID scan
      e.target.value = rfidInputBufferRef.current;
      showErrorToast("Please use RFID scanner. Manual input is disabled.");
      return;
    }

    const value = e.target.value.replace(/\D/g, ""); // Only numbers
    lastRfidInputTimeRef.current = currentTime;
    rfidInputBufferRef.current = value;

    // Add 10ms delay before processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setScannedRfid(value);

    // Wait for complete RFID (at least 10 characters)
    if (value.length >= 10) {
      // Check if RFID is already assigned in local data (check all students, not just current page)
      const existingStudent = allStudents.find(
        (s: Student) => s.rfid_id && String(s.rfid_id) === value
      );

      if (existingStudent) {
        // If we're searching via RFID, load the student
        if (viewMode === "searching-rfid") {
          const truncatedName = truncateName(
            existingStudent.firstName,
            existingStudent.lastName
          );
          showSuccessToast(`Found student: ${truncatedName}`);
          handleSelectStudent(existingStudent);
          setScannedRfid("");
          setIsScanning(false);
          lastRfidInputTimeRef.current = 0;
          rfidInputBufferRef.current = "";
          if (rfidInputRef.current) rfidInputRef.current.value = "";
          return;
        }

        // If we're assigning RFID or creating, show error
        if (viewMode === "assigning-rfid" || viewMode === "creating") {
          const truncatedName = truncateName(
            existingStudent.firstName,
            existingStudent.lastName
          );
          showErrorToast(
            `RFID "${value}" is already assigned to ${truncatedName}`
          );
          setScannedRfid("");
          setIsScanning(false);
          lastRfidInputTimeRef.current = 0;
          rfidInputBufferRef.current = "";
          if (rfidInputRef.current) rfidInputRef.current.value = "";
          return;
        }
      }

      // If searching and no student found locally, search in database by rfid_id only
      if (viewMode === "searching-rfid") {
        // Show loading toast
        const loadingToastId = toast.loading("Searching for student...");

        try {
          // Search in database using the RFID-specific endpoint (searches only by rfid_id, not studentId)
          const searchResult = await studentsService.getByRfid(value);

          if (searchResult?.student) {
            const foundStudent = searchResult.student;
            const mappedStudent: Student = {
              id: foundStudent.id,
              rfid_id: foundStudent.rfid_id
                ? String(foundStudent.rfid_id)
                : null,
              lastName: foundStudent.lastName,
              firstName: foundStudent.firstName,
              middleInitial: foundStudent.middleInitial || "",
              studentImage: foundStudent.image,
              studentId: foundStudent.studentId,
            };
            const truncatedName = truncateName(
              mappedStudent.firstName,
              mappedStudent.lastName
            );
            // Replace loading toast with success
            toast.success(`Found student: ${truncatedName}`, {
              id: loadingToastId,
            });
            handleSelectStudent(mappedStudent);
            setScannedRfid("");
            setIsScanning(false);
            lastRfidInputTimeRef.current = 0;
            rfidInputBufferRef.current = "";
            if (rfidInputRef.current) rfidInputRef.current.value = "";
            // Refresh the students list to include this student
            await fetchStudents();
            return;
          } else {
            // Replace loading toast with error
            toast.error(`No student found with RFID "${value}"`, {
              id: loadingToastId,
            });
            setScannedRfid("");
            setIsScanning(false);
            lastRfidInputTimeRef.current = 0;
            rfidInputBufferRef.current = "";
            if (rfidInputRef.current) rfidInputRef.current.value = "";
            return;
          }
        } catch (error) {
          console.error("Error searching for RFID:", error);
          // Replace loading toast with error
          toast.error(`No student found with RFID "${value}"`, {
            id: loadingToastId,
          });
          setScannedRfid("");
          setIsScanning(false);
          lastRfidInputTimeRef.current = 0;
          rfidInputBufferRef.current = "";
          if (rfidInputRef.current) rfidInputRef.current.value = "";
          return;
        }
      }

      // Valid RFID scanned for assignment or creation
      if (viewMode === "assigning-rfid" || viewMode === "creating") {
        showSuccessToast(`RFID "${value}" scanned successfully!`);
        setIsScanning(false);
        // Update scannedRfid state for the visible input
        setScannedRfid(value);
      }
    } else {
      // Reset timeout if input stops (only for scanning modes, not manual input)
      if (viewMode === "assigning-rfid" || viewMode === "searching-rfid") {
        scanTimeoutRef.current = setTimeout(() => {
          if (value.length > 0 && value.length < 10) {
            showErrorToast("Incomplete RFID scan. Please try again.");
          }
          setScannedRfid("");
          lastRfidInputTimeRef.current = 0;
          rfidInputBufferRef.current = "";
          if (rfidInputRef.current) {
            rfidInputRef.current.value = "";
          }
        }, 1000);
      }
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
        rfid_id: scannedRfid
          ? parseInt(scannedRfid, 10)
          : selectedStudent?.rfid_id
          ? parseInt(String(selectedStudent.rfid_id), 10)
          : undefined,
      };

      let response;
      if (viewMode === "editing" && selectedStudent?.id) {
        // Update existing student
        await studentsService.update(selectedStudent.id, studentData);
        showSuccessToast("Student updated successfully!");
      } else {
        // Create new student
        await studentsService.create(studentData);
        showSuccessToast("Student created successfully!");
      }

      await fetchStudents();
      resetToIdle();
    } catch (error) {
      console.error("Error submitting student:", error);
      showErrorToast("Failed to save student. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle RFID assignment only
  const handleAssignRfidOnly = async () => {
    if (!selectedStudent || !scannedRfid) return;

    setIsSubmitting(true);

    try {
      await studentsService.assignRfid({
        rfid: parseInt(scannedRfid, 10),
        studentId: selectedStudent.id,
      });

      showSuccessToast(`RFID assigned successfully!`);
      await fetchStudents();
      resetToIdle();
    } catch (error: any) {
      console.error("Error assigning RFID:", error);
      showErrorToast(error.message || "Failed to assign RFID");
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

            <div className="flex flex-col items-center gap-3 mb-4">
              {isScanning ? (
                <>
                  <Button
                    onClick={resetToIdle}
                    size="lg"
                    variant="outline"
                    className="w-full max-w-[200px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled
                    size="lg"
                    className="w-full max-w-[200px] bg-[#124A69] hover:bg-[#0a2f42] text-white"
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
                  type="text"
                  inputMode="numeric"
                  value={formData.studentId}
                  onChange={(e) => {
                    // Only allow numbers
                    const value = e.target.value.replace(/\D/g, "");
                    setFormData((prev) => ({
                      ...prev,
                      studentId: value,
                    }));
                  }}
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

              {viewMode === "creating" && (
                <div className="space-y-2" ref={rfidScanContainerRef}>
                  <Label htmlFor="rfid">
                    RFID{" "}
                    <span className="text-xs text-muted-foreground">
                      (Optional)
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    {scannedRfid ? (
                      <div className="flex-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          ✓ RFID scanned:{" "}
                          <span className="font-mono font-semibold">
                            {scannedRfid}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 p-3 bg-muted/50 border border-dashed rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">
                          No RFID scanned
                        </p>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setIsScanning(true);
                        lastRfidInputTimeRef.current = 0;
                        rfidInputBufferRef.current = "";
                        if (rfidInputRef.current) {
                          rfidInputRef.current.focus();
                        }
                      }}
                      disabled={!!scannedRfid}
                      className="border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Scan className="w-4 h-4" />
                    </Button>
                  </div>
                  {isScanning && (
                    <div className="text-xs text-blue-600 flex items-center gap-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      Waiting for RFID scan...
                    </div>
                  )}
                  {scannedRfid && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setScannedRfid("");
                        setIsScanning(false);
                        lastRfidInputTimeRef.current = 0;
                        rfidInputBufferRef.current = "";
                        if (rfidInputRef.current) {
                          rfidInputRef.current.value = "";
                        }
                      }}
                      className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Clear RFID
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Click the scan button to scan RFID card. Leave empty if RFID
                    is not available.
                  </p>
                </div>
              )}

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
    <div className="relative min-h-screen w-full overflow-auto">
      <Header />
      <AppSidebar />

      {/* Hidden RFID input - disabled keyboard input, only accepts rapid RFID scans */}
      <input
        ref={rfidInputRef}
        type="text"
        onChange={handleRfidInput}
        onKeyDown={(e) => {
          // Only prevent navigation/editing keys, but allow character input
          // The timing check in onChange will differentiate RFID from manual typing
          if (
            e.key === "Backspace" ||
            e.key === "Delete" ||
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight"
          ) {
            e.preventDefault();
            return false;
          }
          // Allow all other keys (including single characters) to pass through
          // The onChange handler will check timing to reject manual typing
        }}
        onPaste={(e) => {
          // Prevent paste
          e.preventDefault();
          return false;
        }}
        className="absolute -left-[9999px]"
        placeholder="RFID input"
        autoComplete="off"
      />

      <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-x-auto">
        <div className="flex flex-col flex-grow px-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
              Student Management
            </h1>
            <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
              {format(new Date(), "EEEE, MMMM d")}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto pb-6 flex">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl w-full">
              {/* Student Directory */}
              <Card
                className={`md:col-span-1 lg:col-span-1 flex flex-col ${
                  windowHeight < 890 ? "max-h-[600px]" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle>Student Directory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search Students</Label>
                    <Input
                      id="search"
                      placeholder="Search by name or student ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchQuery(value);
                        // Reset to page 1 when search changes (local state only, no URL update)
                        if (currentPage !== 1) {
                          setCurrentPage(1);
                        }
                      }}
                      maxLength={100}
                    />
                  </div>

                  <Button
                    onClick={handleAddNewStudent}
                    className={`w-full bg-[#124A69] hover:bg-[#0a2f42] text-white ${
                      windowHeight < 890 ? "h-9 text-sm" : ""
                    }`}
                  >
                    <Plus
                      className={`mr-2 ${
                        windowHeight < 890 ? "w-3.5 h-3.5" : "w-4 h-4"
                      }`}
                    />
                    Add New Student
                  </Button>

                  <Button
                    onClick={handleSearchViaRfid}
                    variant="outline"
                    className={`w-full border-[#124A69] text-[#124A69] hover:bg-[#124A69] hover:text-white ${
                      windowHeight < 890 ? "h-9 text-sm" : ""
                    }`}
                  >
                    <Scan
                      className={`mr-2 ${
                        windowHeight < 890 ? "w-3.5 h-3.5" : "w-4 h-4"
                      }`}
                    />
                    Search via RFID
                  </Button>

                  <Dialog
                    open={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full border-green-600 text-green-600 hover:bg-green-600 hover:text-white ${
                          windowHeight < 890 ? "h-9 text-sm" : ""
                        }`}
                      >
                        <Upload
                          className={`mr-2 ${
                            windowHeight < 890 ? "w-3.5 h-3.5" : "w-4 h-4"
                          }`}
                        />
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

                  <div
                    className={`space-y-2 overflow-y-auto ${
                      windowHeight < 890 ? "max-h-[250px]" : "max-h-[400px]"
                    }`}
                  >
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Loading...
                      </p>
                    ) : students.length > 0 ? (
                      students.map((student: Student) => (
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
                            <div className="flex-1 min-w-0">
                              <p
                                className="font-semibold truncate"
                                title={`${student.lastName}, ${
                                  student.firstName
                                } ${student.middleInitial || ""}`.trim()}
                              >
                                {student.lastName}, {student.firstName}{" "}
                                {student.middleInitial}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
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

                  {/* Pagination Controls */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} (
                        {pagination.total} total)
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page <= 1 || isLoading}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={
                            pagination.page >= pagination.totalPages ||
                            isLoading
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Form Section */}
              <Card
                className={`md:col-span-1 lg:col-span-1 flex flex-col ${
                  windowHeight < 890 ? "max-h-[600px]" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle>Student Details</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto min-h-0">
                  {renderFormSection()}
                </CardContent>
              </Card>

              {/* ID Preview */}
              <Card
                className={`md:col-span-1 lg:col-span-1 flex flex-col ${
                  windowHeight < 890 ? "max-h-[600px]" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle>ID Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto min-h-0">
                  <div className="bg-white border-2 border-gray-300 rounded-lg shadow-sm overflow-hidden md:mx-auto md:max-w-[420px]">
                    <div
                      className={`bg-[#FEF100] flex flex-col items-center justify-center ${
                        windowHeight < 890 ? "h-[72px]" : "h-20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={STI_logo.src}
                          className={windowHeight < 890 ? "w-32" : "w-35"}
                          alt="STI Logo"
                        />
                      </div>
                    </div>

                    <div
                      className={`bg-blue-800 relative ${
                        windowHeight < 890 ? "p-5" : "p-6"
                      }`}
                    >
                      <div
                        className={`text-[#FEF100] flex justify-center font-semibold ${
                          windowHeight < 890
                            ? "text-lg mb-5 mt-1"
                            : "text-lg mb-7 mt-2"
                        }`}
                      >
                        ALABANG
                      </div>
                      <div
                        className={`flex justify-center ${
                          windowHeight < 890 ? "mb-5" : "mb-7"
                        }`}
                      >
                        <div
                          className={`bg-gray-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden ${
                            windowHeight < 890 ? "w-24 h-24" : "w-70 h-70"
                          }`}
                        >
                          {getPreviewImage() ? (
                            <img
                              src={getPreviewImage()!}
                              alt="Student Photo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span
                              className={`text-gray-500 text-center ${
                                windowHeight < 890 ? "text-[10px]" : "text-xs"
                              }`}
                            >
                              No Photo
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`text-center ${
                          windowHeight < 890 ? "mb-5" : "mb-6"
                        }`}
                      >
                        <div
                          className={`text-white font-bold mb-1 truncate px-2 ${
                            windowHeight < 890 ? "text-2xl" : "text-3xl"
                          }`}
                        >
                          {formData.lastName || "________"}
                        </div>
                        <div
                          className={`text-white truncate px-2 ${
                            windowHeight < 890 ? "text-lg" : "text-lg"
                          }`}
                        >
                          {formData.firstName || "________"}{" "}
                          {formData.middleInitial}
                          {formData.middleInitial ? "." : ""}
                        </div>
                      </div>
                      <div
                        className={`bg-teal-500 rounded-lg text-center ${
                          windowHeight < 890 ? "p-3" : "p-3"
                        }`}
                      >
                        <div
                          className={`text-white font-semibold ${
                            windowHeight < 890 ? "text-lg" : "text-lg"
                          }`}
                        >
                          {formData.studentId || "________"}
                        </div>
                        <div
                          className={`text-white opacity-90 ${
                            windowHeight < 890 ? "text-[10px]" : "text-xs"
                          }`}
                        >
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
