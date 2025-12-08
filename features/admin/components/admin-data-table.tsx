"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Role, WorkType, UserStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import toast from "react-hot-toast";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Download,
  Upload,
  ChevronDown,
  ArrowUpDown,
  ShieldCheck,
} from "lucide-react";
import { UserSheet } from "./user-sheet";
import { editUser } from "@/lib/actions/users";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  useUsers,
  useBreakGlassStatus,
  usePromoteUser,
  useImportUsers,
  queryKeys,
} from "@/lib/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnFiltersState,
  VisibilityState,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
} from "@tanstack/react-table";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  roles: Role[];
  status: UserStatus;
  [key: string]: string | WorkType | Role[] | UserStatus;
}

interface AdminDataTableProps {
  users?: User[]; // Make optional since we'll fetch via hook
  onUserAdded?: () => void;
}

interface CsvRow {
  "Full Name": string;
  Email: string;
  Department: string;
  "Work Type": string;
  Status: string;
  [key: string]: string;
}

interface ImportStatus {
  imported: number;
  skipped: number;
  errors: Array<{ email: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row: number;
    email: string;
    status: string;
    message: string;
  }>;
}

const MAX_PREVIEW_ROWS = 100;
const EXPECTED_HEADERS = [
  "Full Name",
  "Email",
  "Department",
  "Work Type",
  "Status",
];

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length === 3) {
    return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
  } else if (parts.length === 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
};

export function useUserImages() {
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAllImages = async () => {
      setLoading(true);
      setError(null);

      try {
        const bucket = supabase.storage.from("user-images");

        const { data: files, error } = await bucket.list("", { limit: 1000 });
        if (error) throw error;

        if (!files || files.length === 0) {
          console.warn("⚠️ No files found in user-images bucket.");
          if (!cancelled) setImageMap({});
          return;
        }

        console.log(files.map((f) => f.name));

        const entries = files.map((file) => {
          const userId = file.name.replace(/\.(png|jpg|jpeg)$/i, "");
          const { data } = bucket.getPublicUrl(file.name);
          return [userId, `${data.publicUrl}?t=${Date.now()}`];
        });

        if (!cancelled) setImageMap(Object.fromEntries(entries));
      } catch (err: any) {
        console.error("Error fetching user images:", err.message);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllImages();

    // Cleanup if component unmounts
    return () => {
      cancelled = true;
    };
  }, []);
  console.log("User Images Map:", imageMap);
  return { imageMap, loading, error };
}
const formatEnumValue = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

export function AdminDataTable({
  users: initialUsers,
  onUserAdded,
}: AdminDataTableProps) {
  const [tableData, setTableData] = useState<User[]>(initialUsers || []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showImportStatus, setShowImportStatus] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [previewData, setPreviewData] = useState<CsvRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidFile, setIsValidFile] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
    error?: string;
    hasError?: boolean;
  } | null>(null);
  const [isRoleUpdating, setIsRoleUpdating] = useState<Record<string, boolean>>(
    {}
  );
  const [isStatusUpdating, setIsStatusUpdating] = useState<
    Record<string, boolean>
  >({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [userToPromote, setUserToPromote] = useState<User | null>(null);
  const [promotionCode, setPromotionCode] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [isCurrentUserTempAdmin, setIsCurrentUserTempAdmin] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // React Query hooks - Fetch users using the hook
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    error: usersError,
    refetch: refetchUsers,
  } = useUsers();
  const { data: currentUserBreakGlass } = useBreakGlassStatus(
    session?.user?.id
  );
  const promoteUserMutation = usePromoteUser();
  const importUsersMutation = useImportUsers();

  // Set current user temp admin status
  useEffect(() => {
    if (currentUserBreakGlass) {
      setIsCurrentUserTempAdmin(!!currentUserBreakGlass.isActive);
    } else {
      // If break-glass status is not available yet or is null, assume not temp admin
      setIsCurrentUserTempAdmin(false);
    }
    const userRoles = session?.user?.roles || [];
    // Set the primary role (first role or ADMIN if present)
    const primaryRole = userRoles.includes(Role.ADMIN)
      ? Role.ADMIN
      : userRoles.includes(Role.ACADEMIC_HEAD)
      ? Role.ACADEMIC_HEAD
      : userRoles[0] || Role.FACULTY;
    setCurrentUserRole(primaryRole);
  }, [currentUserBreakGlass, session?.user?.roles]);

  // Adjust page size based on window height
  useEffect(() => {
    const updatePageSize = () => {
      const newPageSize = window.innerHeight < 930 ? 6 : 10;
      setPageSize((prevSize) => {
        if (prevSize !== newPageSize) {
          setPagination((prev) => ({
            ...prev,
            pageSize: newPageSize,
            pageIndex: 0, // Reset to first page when page size changes
          }));
          return newPageSize;
        }
        return prevSize;
      });
    };

    // Set initial value
    updatePageSize();

    // Listen for resize events
    window.addEventListener("resize", updatePageSize);

    return () => {
      window.removeEventListener("resize", updatePageSize);
    };
  }, []);

  // Check if a user is a temporary admin
  const checkIsTempAdmin = async (userId: string): Promise<boolean> => {
    try {
      // Use React Query to fetch break-glass status
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.admin.breakGlass(userId),
        queryFn: async () => {
          const { data } = await axios.get(
            `/break-glass/status?userId=${userId}`
          );
          return data;
        },
      });
      return !!data?.isActive;
    } catch (error) {
      console.error("Error checking temp admin status:", error);
      return false;
    }
  };

  const handlePromote = async () => {
    if (!userToPromote || !promotionCode.trim()) {
      toast.error("Please enter the secret code");
      return;
    }

    try {
      await promoteUserMutation.mutateAsync({
        userId: userToPromote.id,
        promotionCode: promotionCode.trim(),
      });

      setShowPromoteDialog(false);
      setPromotionCode("");
      setUserToPromote(null);
      await refreshTableData();
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  // Update table data when users are fetched
  useEffect(() => {
    // API returns users array directly (not wrapped in { users: [...] })
    if (usersData) {
      if (Array.isArray(usersData)) {
        setTableData(usersData);
      } else if (usersData.users && Array.isArray(usersData.users)) {
        // Handle case where response is wrapped
        setTableData(usersData.users);
      }
    } else if (initialUsers && initialUsers.length > 0) {
      // Fallback to initialUsers if hook data is not available yet
      setTableData(initialUsers);
    }
  }, [usersData, initialUsers]);

  // Log error if users fetch fails
  useEffect(() => {
    if (usersError) {
      console.error("Error fetching users:", usersError);
      toast.error("Failed to fetch users");
    }
  }, [usersError]);

  const refreshTableData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      // Single invalidation - React Query will auto-refetch
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users(),
      });
    } catch (error) {
      console.error("Error refreshing table data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const handleRoleChange = useCallback(
    async (userId: string, newRoles: Role[]) => {
      try {
        setIsRoleUpdating((prev) => ({ ...prev, [userId]: true }));

        // Optimistic update
        const previousData = tableData;
        setTableData((prevData) =>
          prevData.map((user) =>
            user.id === userId ? { ...user, roles: newRoles } : user
          )
        );

        const result = await editUser(userId, { roles: newRoles });

        if (result.success) {
          // Single invalidation - React Query will auto-refetch
          queryClient.invalidateQueries({
            queryKey: queryKeys.admin.users(),
          });

          toast.success(
            `Roles updated to ${newRoles.map(formatEnumValue).join(", ")}`,
            {
              duration: 3000,
              position: "top-center",
            }
          );
        } else {
          // Revert optimistic update on error
          setTableData(previousData);
          throw new Error(result.error || "Failed to update roles");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update roles"
        );
      } finally {
        setIsRoleUpdating((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [queryClient, tableData]
  );

  const handleStatusChange = useCallback(
    async (userId: string, newStatus: UserStatus) => {
      // Prevent archiving if user is the last academic head
      if (newStatus === "ARCHIVED") {
        const userToArchive = tableData.find((user) => user.id === userId);
        if (userToArchive?.roles?.includes(Role.ACADEMIC_HEAD)) {
          // Count non-archived academic heads excluding the one being archived
          const activeAcademicHeadCount = tableData.filter(
            (user) =>
              user.roles?.includes(Role.ACADEMIC_HEAD) &&
              user.status === "ACTIVE" &&
              user.id !== userId
          ).length;

          if (activeAcademicHeadCount < 1) {
            toast.error(
              "Cannot archive user. At least one active Academic Head must exist in the system."
            );
            return;
          }
        }
      }

      try {
        setIsStatusUpdating((prev) => ({ ...prev, [userId]: true }));

        // Optimistic update
        const previousData = tableData;
        setTableData((prevData) =>
          prevData.map((user) =>
            user.id === userId ? { ...user, status: newStatus } : user
          )
        );

        const result = await editUser(userId, { status: newStatus });

        if (result.success) {
          // Single invalidation - React Query will auto-refetch
          queryClient.invalidateQueries({
            queryKey: queryKeys.admin.users(),
          });

          toast.success(`Status updated to ${formatEnumValue(newStatus)}`, {
            duration: 3000,
            position: "top-center",
          });
        } else {
          // Revert optimistic update on error
          setTableData(previousData);
          throw new Error(result.error || "Failed to update status");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update status"
        );
      } finally {
        setIsStatusUpdating((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [queryClient, tableData]
  );

  //Done

  //Done
  const handleImportTemplate = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Template");

      // Title
      worksheet.mergeCells("A1:E1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = "USER MANAGEMENT TEMPLATE";
      titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Date row
      worksheet.mergeCells("A2:E2");
      const dateRow = worksheet.getCell("A2");
      dateRow.value = `Date: ${new Date().toLocaleDateString()}`;
      dateRow.font = { italic: true, size: 11 };
      dateRow.alignment = { vertical: "middle", horizontal: "center" };

      // Instructions
      worksheet.mergeCells("A3:E3");
      const instructionTitle = worksheet.getCell("A3");
      instructionTitle.value = "IMPORTANT INSTRUCTIONS";
      instructionTitle.font = {
        bold: true,
        size: 12,
        color: { argb: "FFD97706" },
      };
      instructionTitle.alignment = { vertical: "middle", horizontal: "left" };

      const instructions = [
        "1. All email addresses MUST be from @alabang.sti.edu.ph domain",
        "2. Example: john.doe@alabang.sti.edu.ph",
        "3. Do not include empty rows",
        "4. All fields are required - do not leave any cell empty",
        "5. Do not modify or delete the header row",
        "6. Delete these instruction rows before importing",
        "7. Work Type must be exactly: Full Time or Part Time",
        "8. Status must be exactly: Active or Archived",
        "9. IMPORTANT: Imported users are automatically assigned the Faculty role",
      ];

      instructions.forEach((instruction, index) => {
        worksheet.mergeCells(`A${4 + index}:F${4 + index}`);
        const cell = worksheet.getCell(`A${4 + index}`);
        cell.value = instruction;
        cell.font = { size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFACD" },
        };
      });

      worksheet.addRow([]);

      // Header
      const headerRow = worksheet.addRow(EXPECTED_HEADERS);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 25;

      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Examples
      const examples = [
        [
          "John A. Smith",
          "john.smith@alabang.sti.edu.ph",
          "IT Department",
          "Full Time",
          "Active",
        ],
        [
          "Jane B. Doe",
          "jane.doe@alabang.sti.edu.ph",
          "Mathematics Department",
          "Part Time",
          "Active",
        ],
        [
          "Robert C. Johnson",
          "robert.johnson@alabang.sti.edu.ph",
          "Computer Science Department",
          "Full Time",
          "Active",
        ],
      ];

      examples.forEach((example) => {
        const row = worksheet.addRow(example);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
          cell.alignment = { vertical: "middle" };
        });
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F4F8" },
        };
      });

      worksheet.columns = [
        { width: 20 },
        { width: 30 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `user_import_template_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      saveAs(blob, filename);

      toast.success("Template downloaded successfully");
    } catch (error) {
      console.error("Template error:", error);
      toast.error("Failed to generate template");
    }
  }, []);

  const readFile = useCallback(async (file: File): Promise<CsvRow[]> => {
    try {
      let rawData: string[][];

      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        rawData = text
          .split("\n")
          .map((line) =>
            line
              .split(",")
              .map((cell) => cell.trim().replace(/^["\']|["\']$/g, ""))
          );
      } else {
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error("No worksheet found in file");
        }

        const rows: any[][] = [];
        worksheet.eachRow((row) => {
          const rowValues = row.values as any[];
          rows.push(rowValues.slice(1));
        });

        rawData = rows.map((row) =>
          row.map((cell) =>
            cell !== null && cell !== undefined ? String(cell).trim() : ""
          )
        );
      }

      let headerRowIndex = -1;
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!Array.isArray(row) || row.length < EXPECTED_HEADERS.length)
          continue;

        const isHeaderRow = EXPECTED_HEADERS.every((header, index) => {
          const cellValue =
            typeof row[index] === "string" || typeof row[index] === "number"
              ? String(row[index]).trim().toLowerCase()
              : "";
          return cellValue === header.toLowerCase();
        });

        if (isHeaderRow) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        return [];
      }

      const headers = rawData[headerRowIndex].map(
        (h) => h?.toString().trim() || ""
      );
      const dataRowsRaw = rawData
        .slice(headerRowIndex + 1)
        .filter(
          (row) =>
            Array.isArray(row) &&
            row.some(
              (cell) =>
                cell !== null &&
                cell !== undefined &&
                cell.toString().trim() !== ""
            )
        );

      const formattedData: CsvRow[] = dataRowsRaw.map((row) => {
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] =
            row[index] !== null && row[index] !== undefined
              ? String(row[index]).trim()
              : "";
        });
        return rowData as CsvRow;
      });

      const requiredFields = [
        "Full Name",
        "Email",
        "Department",
        "Work Type",
        "Status",
      ];

      const validFormattedData = formattedData.filter((row): row is CsvRow =>
        requiredFields.every(
          (field) => row[field] && row[field].toString().trim() !== ""
        )
      );

      if (validFormattedData.length === 0) {
        throw new Error(
          "No valid data rows found in file. Please check that there are rows with all required information below the header."
        );
      }

      return validFormattedData;
    } catch (error) {
      throw new Error(
        error instanceof Error && error.message.includes("No valid data")
          ? error.message
          : "Error parsing file. Please make sure you are using a valid file and template format."
      );
    }
  }, []);

  const handleFilePreview = useCallback(
    async (file: File) => {
      try {
        const data = await readFile(file);
        if (data.length > 0) {
          setPreviewData(data.slice(0, MAX_PREVIEW_ROWS));
          setIsValidFile(true);
          toast.success("File loaded successfully");
        } else {
          setIsValidFile(false);
          setPreviewData([]);
          toast.error(
            "Could not find header row. Please make sure the file is using the template format."
          );
        }
      } catch (error) {
        setIsValidFile(false);
        setPreviewData([]);
        toast.error(
          error instanceof Error && error.message.includes("parsing file")
            ? error.message
            : "Error reading file. Please ensure it is a valid Excel or CSV file."
        );
      }
    },
    [readFile]
  );

  const validateFile = useCallback((file: File): boolean => {
    const extension = file.name.toLowerCase().split(".").pop();
    const validExtensions = ["xlsx", "xls", "csv"];

    if (!validExtensions.includes(extension || "")) {
      toast.error(
        "Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file."
      );
      return false;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size too large. Maximum size is 5MB.");
      return false;
    }

    return true;
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (validateFile(file)) {
          setSelectedFile(file);
          handleFilePreview(file);
        } else {
          setSelectedFile(null);
          setPreviewData([]);
          setIsValidFile(false);
        }
      }
    },
    [validateFile, handleFilePreview]
  );

  const handleImport = useCallback(async () => {
    if (!selectedFile || !isValidFile || previewData.length === 0) {
      if (!selectedFile) toast.error("Please select a file first.");
      else if (!isValidFile) toast.error("Selected file is not valid.");
      else if (previewData.length === 0)
        toast.error("No valid data rows found in the file preview.");
      return;
    }

    try {
      setShowImportStatus(true);
      setImportProgress({
        current: 0,
        total: previewData.length,
        status: "Importing users...",
      });

      const result = await importUsersMutation.mutateAsync(previewData);
      const {
        imported,
        skipped,
        errors,
        total: backendTotalProcessed,
        detailedFeedback,
      } = result;

      setImportStatus({
        imported: imported || 0,
        skipped: skipped || 0,
        errors: errors || [],
        total: backendTotalProcessed || previewData.length,
        detailedFeedback: detailedFeedback || [],
      });

      if (errors && errors.length > 0) {
        toast.error(`Import finished with ${errors.length} errors.`);
      } else if (skipped && skipped > 0) {
        toast(`Import finished. ${skipped} users skipped.`, { icon: "⚠️" });
      } else if (imported && imported > 0) {
        toast.success(`Successfully imported ${imported} users.`);
      } else {
        toast("Import process finished with no users imported.", {
          icon: "ℹ️",
        });
      }

      setImportProgress(null);
      setTimeout(async () => {
        await refreshTableData();
        if (onUserAdded) onUserAdded();
      }, 500);
    } catch (error: any) {
      const errorResponse = error?.response?.data;
      const errorMessage =
        errorResponse?.error ||
        (error instanceof Error ? error.message : "Failed to import users");
      const importErrors = errorResponse?.errors || [
        { email: "N/A", message: errorMessage },
      ];

      setImportProgress({
        current: 0,
        total: previewData.length,
        status: "Import failed",
        error: errorMessage,
        hasError: true,
      });
      toast.error(errorMessage);

      setImportStatus({
        imported: errorResponse?.imported || 0,
        skipped: errorResponse?.skipped || 0,
        errors: importErrors,
        total: errorResponse?.total || previewData.length,
        detailedFeedback: errorResponse?.detailedFeedback || [],
      });
    }
  }, [selectedFile, isValidFile, previewData, refreshTableData, onUserAdded]);
  const { imageMap } = useUserImages();

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const { id, name } = row.original;
          const imageUrl = imageMap[id];
          console.log("🖼️ Row:", id, "→", imageUrl);
          return (
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage src={imageUrl} alt={name} />
                <AvatarFallback>{getInitials(name)}</AvatarFallback>
              </Avatar>
              <div>{name}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        sortingFn: (rowA, rowB) => {
          const emailA = (rowA.original.email || "").toLowerCase();
          const emailB = (rowB.original.email || "").toLowerCase();
          return emailA.localeCompare(emailB);
        },
      },
      {
        accessorKey: "department",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Department
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },
      {
        accessorKey: "workType",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Work Type
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => formatEnumValue(row.original.workType),
      },
      {
        accessorKey: "roles",
        header: "Roles",
        cell: ({ row }) => {
          const userRoles = row.original.roles || [];
          const isCurrentUser = row.original.id === session?.user?.id;
          const currentUserHasAdmin = session?.user?.roles?.includes(
            Role.ADMIN
          );

          // Check if current user is temp admin and if target user is ADMIN/ACADEMIC_HEAD
          const isTargetAdminOrHead =
            userRoles.includes(Role.ADMIN) ||
            userRoles.includes(Role.ACADEMIC_HEAD);
          // Always disable for temp admins viewing ADMIN/ACADEMIC_HEAD users
          const isDisabledForTempAdmin =
            isCurrentUserTempAdmin && isTargetAdminOrHead;

          const handleRoleToggle = (role: Role, checked: boolean) => {
            // Prevent self-demotion: don't allow removing ADMIN role from self
            if (
              isCurrentUser &&
              currentUserHasAdmin &&
              role === Role.ADMIN &&
              !checked
            ) {
              toast.error("You cannot remove your own Admin role");
              return;
            }

            // Prevent temp admin from assigning ADMIN or ACADEMIC_HEAD roles
            if (
              isCurrentUserTempAdmin &&
              (role === Role.ADMIN || role === Role.ACADEMIC_HEAD) &&
              checked
            ) {
              toast.error(
                "Temporary admins cannot assign Admin or Academic Head roles"
              );
              return;
            }

            // Prevent temp admin from removing ADMIN or ACADEMIC_HEAD roles from existing users
            if (
              isCurrentUserTempAdmin &&
              (userRoles.includes(Role.ADMIN) ||
                userRoles.includes(Role.ACADEMIC_HEAD)) &&
              !checked &&
              (role === Role.ADMIN || role === Role.ACADEMIC_HEAD)
            ) {
              toast.error(
                "Temporary admins cannot modify Admin or Academic Head roles"
              );
              return;
            }

            // Prevent removing ADMIN role if it's the last admin
            if (role === Role.ADMIN && !checked) {
              const adminCount = tableData.filter((user) =>
                user.roles?.includes(Role.ADMIN)
              ).length;
              if (adminCount <= 1) {
                toast.error(
                  "Cannot remove Admin role. At least one Admin must exist in the system."
                );
                return;
              }
            }

            // Prevent removing ACADEMIC_HEAD role if it's the last academic head
            if (role === Role.ACADEMIC_HEAD && !checked) {
              const academicHeadCount = tableData.filter((user) =>
                user.roles?.includes(Role.ACADEMIC_HEAD)
              ).length;
              if (academicHeadCount <= 1) {
                toast.error(
                  "Cannot remove Academic Head role. At least one Academic Head must exist in the system."
                );
                return;
              }
            }

            let newRoles: Role[];
            if (checked) {
              // Prevent having both ADMIN and ACADEMIC_HEAD roles
              if (
                role === Role.ADMIN &&
                userRoles.includes(Role.ACADEMIC_HEAD)
              ) {
                toast.error(
                  "A user cannot have both Admin and Academic Head roles. Please remove Academic Head role first."
                );
                return;
              }
              if (
                role === Role.ACADEMIC_HEAD &&
                userRoles.includes(Role.ADMIN)
              ) {
                toast.error(
                  "A user cannot have both Admin and Academic Head roles. Please remove Admin role first."
                );
                return;
              }
              newRoles = [...userRoles, role];
            } else {
              // Ensure at least one role remains
              if (userRoles.length === 1) {
                toast.error("User must have at least one role");
                return;
              }
              newRoles = userRoles.filter((r) => r !== role);
            }

            handleRoleChange(row.original.id, newRoles);
          };

          const displayText =
            userRoles.length === 0
              ? "No roles"
              : userRoles.length === 1
              ? formatEnumValue(userRoles[0])
              : userRoles.map(formatEnumValue).join(", ");

          return (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[180px] justify-start"
                  disabled={
                    isRoleUpdating[row.original.id] || isDisabledForTempAdmin
                  }
                >
                  {isRoleUpdating[row.original.id] ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#124A69]" />
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <>
                      <span className="truncate">{displayText}</span>
                      <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-2">
                  {[
                    { value: Role.FACULTY, label: "Faculty" },
                    { value: Role.ADMIN, label: "Admin" },
                    { value: Role.ACADEMIC_HEAD, label: "Academic Head" },
                  ]
                    .filter(
                      (role) =>
                        !isCurrentUserTempAdmin || role.value === Role.FACULTY
                    )
                    .map((role) => {
                      const isChecked = userRoles.includes(role.value);
                      const isDisabledForTemp =
                        isCurrentUserTempAdmin &&
                        (userRoles.includes(Role.ADMIN) ||
                          userRoles.includes(Role.ACADEMIC_HEAD)) &&
                        (role.value === Role.ADMIN ||
                          role.value === Role.ACADEMIC_HEAD);
                      // Prevent self-demotion: disable unchecking ADMIN role for self
                      const isDisabledForSelf =
                        isCurrentUser &&
                        currentUserHasAdmin &&
                        role.value === Role.ADMIN &&
                        isChecked;
                      // Prevent removing last admin
                      const isLastAdmin =
                        role.value === Role.ADMIN &&
                        isChecked &&
                        tableData.filter((user) =>
                          user.roles?.includes(Role.ADMIN)
                        ).length <= 1;
                      // Prevent removing last academic head
                      const isLastAcademicHead =
                        role.value === Role.ACADEMIC_HEAD &&
                        isChecked &&
                        tableData.filter((user) =>
                          user.roles?.includes(Role.ACADEMIC_HEAD)
                        ).length <= 1;
                      // Prevent checking ADMIN if user has ACADEMIC_HEAD, and vice versa
                      const isMutuallyExclusive =
                        (role.value === Role.ADMIN &&
                          userRoles.includes(Role.ACADEMIC_HEAD)) ||
                        (role.value === Role.ACADEMIC_HEAD &&
                          userRoles.includes(Role.ADMIN));
                      const isDisabled =
                        isDisabledForTemp ||
                        isDisabledForSelf ||
                        isLastAdmin ||
                        isLastAcademicHead ||
                        isMutuallyExclusive;

                      // Determine tooltip message based on why it's disabled
                      let tooltipMessage = "";
                      if (isMutuallyExclusive) {
                        if (role.value === Role.ADMIN) {
                          tooltipMessage =
                            "Cannot assign Admin role while user has Academic Head role. Please remove Academic Head role first.";
                        } else {
                          tooltipMessage =
                            "Cannot assign Academic Head role while user has Admin role. Please remove Admin role first.";
                        }
                      } else if (isLastAdmin) {
                        tooltipMessage =
                          "Cannot remove Admin role. At least one Admin must exist in the system.";
                      } else if (isLastAcademicHead) {
                        tooltipMessage =
                          "Cannot remove Academic Head role. At least one Academic Head must exist in the system.";
                      } else if (isDisabledForSelf) {
                        tooltipMessage =
                          "You cannot remove your own Admin role";
                      } else if (isDisabledForTemp) {
                        tooltipMessage =
                          "Temporary admins cannot modify Admin or Academic Head roles";
                      }

                      const checkboxElement = (
                        <Checkbox
                          id={`role-${row.original.id}-${role.value}`}
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            handleRoleToggle(role.value, checked as boolean)
                          }
                          disabled={isDisabled}
                          className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]"
                        />
                      );

                      return (
                        <div
                          key={role.value}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50"
                        >
                          {isDisabled && tooltipMessage ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-not-allowed">
                                  {checkboxElement}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{tooltipMessage}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            checkboxElement
                          )}
                          <label
                            htmlFor={`role-${row.original.id}-${role.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {role.label}
                          </label>
                        </div>
                      );
                    })}
                </div>
              </PopoverContent>
            </Popover>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const isCurrentUser = row.original.id === session?.user?.id;
          const currentUserHasAdmin = session?.user?.roles?.includes(
            Role.ADMIN
          );
          // Prevent self-archiving for admins
          const isSelfWithAdmin = isCurrentUser && currentUserHasAdmin;

          // Check if user is the last academic head
          const isLastAcademicHead =
            row.original.roles?.includes(Role.ACADEMIC_HEAD) &&
            row.original.status === "ACTIVE" &&
            tableData.filter(
              (user) =>
                user.roles?.includes(Role.ACADEMIC_HEAD) &&
                user.status === "ACTIVE" &&
                user.id !== row.original.id
            ).length < 1;

          const isStatusDisabled =
            isStatusUpdating[row.original.id] ||
            (isSelfWithAdmin && row.original.status === "ACTIVE") ||
            (isLastAcademicHead && row.original.status === "ACTIVE");

          // Determine tooltip message
          let statusTooltipMessage = "";
          if (isLastAcademicHead && row.original.status === "ACTIVE") {
            statusTooltipMessage =
              "Cannot archive user. At least one active Academic Head must exist in the system.";
          } else if (isSelfWithAdmin && row.original.status === "ACTIVE") {
            statusTooltipMessage = "You cannot archive yourself";
          }

          const selectElement = (
            <Select
              value={row.original.status}
              onValueChange={(value: UserStatus) => {
                // Prevent self-archiving for admins
                if (isSelfWithAdmin && value === "ARCHIVED") {
                  toast.error("You cannot archive yourself");
                  return;
                }
                // Prevent archiving last academic head
                if (isLastAcademicHead && value === "ARCHIVED") {
                  toast.error(
                    "Cannot archive user. At least one active Academic Head must exist in the system."
                  );
                  return;
                }
                handleStatusChange(row.original.id, value);
              }}
              disabled={isStatusDisabled}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue>
                  {isStatusUpdating[row.original.id] ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#124A69]" />
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          row.original.status === "ACTIVE"
                            ? "bg-green-500"
                            : "bg-gray-500"
                        }`}
                      />
                      <span>
                        {row.original.status === "ACTIVE"
                          ? "Active"
                          : "Archived"}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Active</span>
                  </div>
                </SelectItem>
                <SelectItem value="ARCHIVED">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gray-500" />
                    <span>Archived</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          );

          return (
            <>
              {isStatusDisabled && statusTooltipMessage ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-not-allowed inline-block">
                      {selectElement}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{statusTooltipMessage}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                selectElement
              )}
            </>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {/* Hide Edit User for current user (self-protection) and ADMIN/ACADEMIC_HEAD when current user is temp admin */}
              {row.original.id !== session?.user?.id &&
                !(
                  isCurrentUserTempAdmin &&
                  (row.original.roles?.includes(Role.ADMIN) ||
                    row.original.roles?.includes(Role.ACADEMIC_HEAD))
                ) && (
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => setEditingUser(row.original)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit User
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [
      isRoleUpdating,
      isStatusUpdating,
      handleRoleChange,
      handleStatusChange,
      imageMap,
      isCurrentUserTempAdmin,
      currentUserRole,
      session?.user?.id,
      session?.user?.roles,
      tableData,
    ]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
  });

  //Done
  const handleExport = useCallback(async () => {
    try {
      // Log export operation
      try {
        // Extract filter values from table state
        const emailFilter = table.getColumn("email")?.getFilterValue() as
          | string
          | undefined;
        const roleFilter = columnFilters.find((f) => f.id === "role")?.value as
          | string
          | undefined;
        const departmentFilter = columnFilters.find(
          (f) => f.id === "department"
        )?.value as string | undefined;
        const statusFilter = columnFilters.find((f) => f.id === "status")
          ?.value as string | undefined;

        await fetch("/api/users/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            count: tableData.length,
            filters: {
              search: emailFilter || null,
              role: roleFilter || null,
              department: departmentFilter || null,
              status: statusFilter || null,
            },
          }),
        });
      } catch (error) {
        console.error("Error logging export:", error);
        // Continue with export even if logging fails
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Users");

      // Title row
      worksheet.mergeCells("A1:G1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = "USER MANAGEMENT DATA";
      titleRow.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Date row
      worksheet.mergeCells("A2:G2");
      const dateRow = worksheet.getCell("A2");
      dateRow.value = `Date: ${new Date().toLocaleDateString()}`;
      dateRow.font = { italic: true, size: 11 };
      dateRow.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]);

      // Header row
      const headerRow = worksheet.addRow(EXPECTED_HEADERS);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF124A69" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 25;

      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Data rows
      tableData.forEach((user: User) => {
        const row = worksheet.addRow([
          user.name || "",
          user.email || "",
          user.department || "",
          formatEnumValue(user.workType),
          formatEnumValue(user.status),
        ]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
          cell.alignment = { vertical: "middle" };
        });

        if (row.number % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        }
      });

      // Set column widths
      worksheet.columns = [
        { width: 20 },
        { width: 30 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename = `user_data_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      saveAs(blob, filename);

      toast.success("User data exported successfully");
      setShowExportPreview(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  }, [tableData, table, columnFilters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={
                (table.getColumn("email")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("email")?.setFilterValue(event.target.value)
              }
              className="pl-8 w-full"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={() => setShowImportPreview(true)}
            title="Import Users"
            className="w-full sm:w-auto"
          >
            Import
            <Download className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            title="Export Users"
            className="w-full sm:w-auto"
          >
            Export
            <Upload className="h-4 w-4 ml-2" />
          </Button>
          <div className="w-full sm:w-auto">
            <UserSheet mode="add" onSuccess={refreshTableData} />
          </div>
        </div>
      </div>

      {/* Table and Pagination Container */}
      <div className="flex flex-col" style={{ height: "calc(100vh - 320px)" }}>
        {/* Table container with controlled height */}
        <div className="flex-1 rounded-md border overflow-auto min-h-0">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="whitespace-normal md:whitespace-nowrap"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isRefreshing || isLoadingUsers ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#124A69]" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="break-words">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination - fixed at bottom */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between sm:justify-end w-full mt-4 gap-3 py-2 bg-white border-t">
          <span className="text-sm text-gray-600 order-2 sm:order-1 sm:mr-4 w-100">
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}
            -
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{" "}
            of {table.getFilteredRowModel().rows.length} users
          </span>
          <Pagination className="order-1 sm:order-2 flex justify-end">
            <PaginationContent className="flex-wrap justify-center gap-1">
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => table.previousPage()}
                  className={
                    !table.getCanPreviousPage()
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {Array.from({ length: table.getPageCount() }, (_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    onClick={() => table.setPageIndex(i)}
                    isActive={table.getState().pagination.pageIndex === i}
                    className={`cursor-pointer ${
                      table.getState().pagination.pageIndex === i
                        ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                        : ""
                    }`}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => table.nextPage()}
                  className={
                    !table.getCanNextPage()
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {editingUser && (
        <UserSheet
          mode="edit"
          user={editingUser}
          onSuccess={refreshTableData}
          onSave={async (userId, data) => {
            const result = await editUser(userId, data);
            if (result.success) {
              // Invalidate and refetch users to update stats (including workType changes)
              await queryClient.invalidateQueries({
                queryKey: queryKeys.admin.users(),
              });
              await refetchUsers();
            } else {
              throw new Error(result.error || "Failed to update user");
            }
          }}
          onClose={() => setEditingUser(null)}
        />
      )}

      <Dialog open={showExportPreview} onOpenChange={setShowExportPreview}>
        <DialogContent className="w-[90vw] max-w-[1200px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Export Users to Excel
            </DialogTitle>
            <DialogDescription>
              Preview of {tableData.length}{" "}
              {tableData.length === 1 ? "user" : "users"} to be exported
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 border rounded-lg">
            <div className="max-h-[450px] overflow-auto overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-b">
                      #
                    </th>
                    {EXPECTED_HEADERS.map((header) => (
                      <th
                        key={header}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-b whitespace-normal md:whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.slice(0, MAX_PREVIEW_ROWS).map((user, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {user.department}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatEnumValue(user.workType)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatEnumValue(user.status)}
                      </td>
                    </tr>
                  ))}
                  {tableData.length > MAX_PREVIEW_ROWS && (
                    <tr className="border-t bg-gray-50">
                      <td
                        colSpan={6}
                        className="px-4 py-3 text-sm text-gray-600 text-center font-medium"
                      >
                        + {tableData.length - MAX_PREVIEW_ROWS} more{" "}
                        {tableData.length - MAX_PREVIEW_ROWS === 1
                          ? "user"
                          : "users"}{" "}
                        will be exported
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Total users to export:{" "}
              <span className="font-semibold">{tableData.length}</span>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowExportPreview(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                onClick={handleExport}
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showImportPreview} onOpenChange={setShowImportPreview}>
        <DialogContent
          className={`p-4 sm:p-6 h-auto ${
            previewData.length > 0 ? "w-[65vw]" : "w-[40vw]"
          }`}
        >
          <DialogHeader className="w-full">
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Import Users
            </DialogTitle>
            <DialogDescription>
              Please upload a file following the template format below:
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Imported users are automatically assigned
                the Faculty role. Roles can be changed later in the user
                management table.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-white hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Choose File
              </Button>
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedFile.name}
                  </span>
                  <Badge
                    variant={isValidFile ? "default" : "destructive"}
                    className={
                      isValidFile
                        ? "bg-[#124A69] text-white hover:bg-[#0D3A54]"
                        : ""
                    }
                  >
                    {isValidFile ? "Valid" : "Invalid"}
                  </Badge>
                </div>
              )}
            </div>

            {previewData.length > 0 ? (
              <div className="border rounded-lg w-full">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="font-medium text-gray-700">
                    Preview Import Data
                  </h3>
                  <p className="text-sm text-gray-500">
                    Showing {previewData.length}{" "}
                    {previewData.length === 1 ? "row" : "rows"} from import file
                  </p>
                </div>
                <div className="max-h-[350px] overflow-auto overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {EXPECTED_HEADERS.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-2 text-left text-sm font-medium text-gray-500 whitespace-normal md:whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Full Name"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Email"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Department"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Work Type"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Status"]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 border rounded-lg bg-gray-50">
                <p className="text-gray-500">
                  No preview available. Please select a file to import.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportPreview(false);
                  setSelectedFile(null);
                  setPreviewData([]);
                  setIsValidFile(false);
                  setImportProgress(null);
                }}
                disabled={!!importProgress}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleImportTemplate}
                className="bg-white hover:bg-gray-50"
                disabled={!!importProgress}
              >
                Download Template
              </Button>
              <Button
                className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                onClick={handleImport}
                disabled={
                  !selectedFile ||
                  !isValidFile ||
                  !!importProgress ||
                  importUsersMutation.isPending
                }
              >
                {importUsersMutation.isPending
                  ? "Importing..."
                  : "Import Users"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showImportStatus} onOpenChange={setShowImportStatus}>
        <DialogContent className="w-[40vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Import Status
            </DialogTitle>
            <DialogDescription>
              {importProgress
                ? "Import in progress..."
                : "Summary of the import process"}
            </DialogDescription>
          </DialogHeader>

          {importProgress ? (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
                {importProgress.hasError ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-500"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                ) : (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#124A69]" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {importProgress.status}
                  </p>
                  {importProgress.error && (
                    <p className="mt-2 text-sm text-red-600">
                      {importProgress.error}
                    </p>
                  )}
                  {importProgress.total > 0 && !importProgress.hasError && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-[#124A69] h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            (importProgress.current / importProgress.total) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {importProgress.hasError && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowImportStatus(false);
                      setImportProgress(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          ) : (
            importStatus && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="text-sm font-medium text-green-800">
                      Successfully Imported
                    </h3>
                    <p className="text-2xl font-semibold text-green-600">
                      {
                        importStatus.detailedFeedback.filter(
                          (f) => f.status === "imported"
                        ).length
                      }
                    </p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h3 className="text-sm font-medium text-amber-800">
                      Skipped
                    </h3>
                    <p className="text-2xl font-semibold text-amber-600">
                      {
                        importStatus.detailedFeedback.filter(
                          (f) => f.status === "skipped"
                        ).length
                      }
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h3 className="text-sm font-medium text-red-800">Errors</h3>
                    <p className="text-2xl font-semibold text-red-600">
                      {
                        importStatus.detailedFeedback.filter(
                          (f) => f.status === "error"
                        ).length
                      }
                    </p>
                  </div>
                </div>

                {importStatus.detailedFeedback?.length > 0 && (
                  <div className="border rounded-lg overflow-hidden max-w-full">
                    <div className="bg-gray-50 p-4 border-b">
                      <h3 className="font-medium text-gray-700">
                        Detailed Import Feedback
                      </h3>
                      <p className="text-sm text-gray-500">
                        Status of each row processed during import.
                      </p>
                    </div>
                    <div className="max-h-[300px] overflow-auto overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 whitespace-normal md:whitespace-nowrap">
                              Row
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 whitespace-normal md:whitespace-nowrap">
                              Email
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 whitespace-normal md:whitespace-nowrap">
                              Status
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 whitespace-normal md:whitespace-nowrap">
                              Message
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {importStatus.detailedFeedback.map(
                            (feedback, index) => (
                              <tr
                                key={index}
                                className="border-t hover:bg-gray-50"
                              >
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {feedback.row}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {feedback.email}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium">
                                  <Badge
                                    variant={
                                      feedback.status === "imported"
                                        ? "default"
                                        : feedback.status === "skipped"
                                        ? "secondary"
                                        : "destructive"
                                    }
                                    className={
                                      feedback.status === "imported"
                                        ? "bg-green-500 text-white"
                                        : ""
                                    }
                                  >
                                    {feedback.status.charAt(0).toUpperCase() +
                                      feedback.status.slice(1)}
                                  </Badge>
                                </td>
                                <td
                                  className={`px-4 py-2 text-sm ${
                                    feedback.status === "error"
                                      ? "text-red-600"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {feedback.message || "-"}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowImportStatus(false);
                      setShowImportPreview(false);
                      setSelectedFile(null);
                      setPreviewData([]);
                      setIsValidFile(false);
                      setImportProgress(null);
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
                    onClick={() => {
                      setShowImportStatus(false);
                      setShowImportPreview(true);
                    }}
                  >
                    Import More Users
                  </Button>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Promotion Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#124A69]">
              <ShieldCheck className="w-5 h-5" />
              Promote to Permanent Admin
            </DialogTitle>
            <DialogDescription>
              Enter the secret code that was emailed to the Academic Head who
              activated the break-glass override for{" "}
              <strong>{userToPromote?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-3 rounded">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Note:</strong> This action will permanently promote the
                temporary admin to a permanent Admin role. The secret code was
                sent to the Academic Head's email when the break-glass override
                was activated.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotionCode">
                Secret Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="promotionCode"
                type="text"
                placeholder="Enter the 32-character secret code"
                value={promotionCode}
                onChange={(e) => setPromotionCode(e.target.value)}
                className="font-mono"
                maxLength={32}
              />
              <p className="text-xs text-gray-500">
                The code should be 32 characters long and was sent via email.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowPromoteDialog(false);
                setPromotionCode("");
                setUserToPromote(null);
              }}
              disabled={promoteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#124A69] hover:bg-[#0D3A54] text-white"
              onClick={handlePromote}
              disabled={promoteUserMutation.isPending || !promotionCode.trim()}
            >
              {promoteUserMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Promoting...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Promote
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
