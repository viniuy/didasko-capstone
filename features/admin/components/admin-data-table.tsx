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
import { Role, WorkType, Permission } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import toast, { Toaster } from "react-hot-toast";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Download,
  Upload,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { UserSheet } from "./user-sheet";
import { editUser, deleteUser } from "@/lib/actions/users";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/svdialog";
import * as XLSX from "xlsx";
import axiosInstance from "@/lib/axios";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
} from "@tanstack/react-table";
import { supabase } from "@/lib/supabaseClient";
interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  workType: WorkType;
  role: Role;
  permission: Permission;
  [key: string]: string | WorkType | Role | Permission;
}

interface AdminDataTableProps {
  users: User[];
  onUserAdded?: () => void;
}

interface CsvRow {
  "Full Name": string;
  Email: string;
  Department: string;
  "Work Type": string;
  Role: string;
  Permission: string;
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
  "Role",
  "Permission",
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

        // ✅ List all files in the bucket root
        const { data: files, error } = await bucket.list("", { limit: 1000 });
        if (error) throw error;

        if (!files || files.length === 0) {
          console.warn("⚠️ No files found in user-images bucket.");
          if (!cancelled) setImageMap({});
          return;
        }

        console.log(
          "✅ Found files:",
          files.map((f) => f.name)
        );

        // ✅ Map files to { userId: imageUrl }
        const entries = files.map((file) => {
          const userId = file.name.replace(/\.(png|jpg|jpeg)$/i, "");
          const { data } = bucket.getPublicUrl(file.name);
          return [userId, `${data.publicUrl}?t=${Date.now()}`];
        });

        if (!cancelled) setImageMap(Object.fromEntries(entries));
      } catch (err: any) {
        console.error("❌ Error fetching user images:", err.message);
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
  const [tableData, setTableData] = useState<User[]>(initialUsers);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
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
  const [isPermissionUpdating, setIsPermissionUpdating] = useState<
    Record<string, boolean>
  >({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshTableData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await axiosInstance.get("/users");
      const data = await response.data;
      if (data.users) {
        const existingUsersMap = new Map(
          tableData.map((user) => [user.id, user])
        );
        const mergedUsers = data.users.map((newUser: User) => {
          const existingUser = existingUsersMap.get(newUser.id);
          return existingUser ? { ...existingUser, ...newUser } : newUser;
        });
        const newUsers = tableData.filter(
          (user) => !data.users.some((newUser: User) => newUser.id === user.id)
        );
        setTableData([...mergedUsers, ...newUsers]);
      }
    } catch (error) {
      console.error("Error refreshing table data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [tableData]);

  useEffect(() => {
    if (initialUsers.length > 0) {
      setTableData(initialUsers);
    }
  }, [initialUsers]);

  const handleRoleChange = useCallback(
    async (userId: string, newRole: Role) => {
      try {
        setIsRoleUpdating((prev) => ({ ...prev, [userId]: true }));
        const result = await editUser(userId, { role: newRole });

        if (result.success) {
          setTableData((prevData) =>
            prevData.map((user) =>
              user.id === userId ? { ...user, role: newRole } : user
            )
          );
          toast.success(`Role updated to ${formatEnumValue(newRole)}`, {
            duration: 3000,
            position: "top-center",
          });
        } else {
          throw new Error(result.error || "Failed to update role");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update role"
        );
      } finally {
        setIsRoleUpdating((prev) => ({ ...prev, [userId]: false }));
      }
    },
    []
  );

  const handlePermissionChange = useCallback(
    async (userId: string, newPermission: Permission) => {
      try {
        setIsPermissionUpdating((prev) => ({ ...prev, [userId]: true }));
        const result = await editUser(userId, { permission: newPermission });

        if (result.success) {
          setTableData((prevData) =>
            prevData.map((user) =>
              user.id === userId ? { ...user, permission: newPermission } : user
            )
          );
          toast.success(`Permission ${newPermission.toLowerCase()}`, {
            duration: 3000,
            position: "top-center",
          });
        } else {
          throw new Error(result.error || "Failed to update permission");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update permission"
        );
      } finally {
        setIsPermissionUpdating((prev) => ({ ...prev, [userId]: false }));
      }
    },
    []
  );

  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete) return;

    try {
      setIsRefreshing(true);
      const result = await deleteUser(userToDelete.id);

      if (result.success) {
        toast.success("User deleted successfully");
        await refreshTableData();
      } else {
        if (
          result.error?.includes("not found") ||
          result.error?.includes("does not exist")
        ) {
          toast.error("User no longer exists. The table will be refreshed.");
          await refreshTableData();
        } else {
          toast.error(result.error || "Failed to delete user");
        }
      }
    } catch (error) {
      toast.error("An error occurred while deleting the user");
    } finally {
      setUserToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  }, [userToDelete, refreshTableData]);

  //Done
  const handleExport = useCallback(() => {
    try {
      const header = [
        ["USER MANAGEMENT DATA"],
        [""],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        EXPECTED_HEADERS,
      ];

      const userRows = tableData.map((user: User) => {
        return [
          user.id,
          user.name || "",
          user.email || "",
          user.department || "",
          formatEnumValue(user.workType),
          formatEnumValue(user.role),
          user.permission.toLowerCase(),
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([...header, ...userRows]);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 30 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Users");
      const filename = `user_data_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("User data exported successfully");
      setShowExportPreview(false);
    } catch (error) {
      toast.error("Failed to export data");
    }
  }, [tableData]);

  //Done
  const handleImportTemplate = useCallback(() => {
    try {
      const header = [
        ["USER MANAGEMENT TEMPLATE"],
        [""],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        ["IMPORTANT NOTES:"],
        ["1. All email addresses MUST be from @alabang.sti.edu.ph domain"],
        ["2. Example: john.doe@alabang.sti.edu.ph"],
        ["3. Do not include empty rows"],
        ["4. All fields are required"],
        [""],
        EXPECTED_HEADERS,
      ];

      const exampleRow = [
        "John A. Smith",
        "john.smith@alabang.sti.edu.ph",
        "IT Department",
        "Full Time",
        "Faculty",
        "Granted",
      ];

      const ws = XLSX.utils.aoa_to_sheet([...header, exampleRow]);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 30 },
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
      ];
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 3 } },
        { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } },
        { s: { r: 8, c: 0 }, e: { r: 8, c: 3 } },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      const filename = `user_import_template_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Template downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate template");
    }
  }, []);

  const readFile = useCallback((file: File): Promise<CsvRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error("No data found in file"));
            return;
          }

          let rawData: string[][];

          if (file.name.toLowerCase().endsWith(".csv")) {
            const csvData = data.toString();
            rawData = csvData
              .split("\n")
              .map((line) =>
                line
                  .split(",")
                  .map((cell) => cell.trim().replace(/^["\']|["\']$/g, ""))
              );
          } else {
            const workbook = XLSX.read(data, { type: "binary" });
            if (!workbook.SheetNames.length) {
              reject(new Error("No sheets found in the file"));
              return;
            }
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const csvString = XLSX.utils.sheet_to_csv(worksheet, {
              blankrows: false,
              forceQuotes: true,
            });
            rawData = csvString
              .split("\n")
              .map((line) =>
                line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
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
            resolve([]);
            return;
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
            "Role",
            "Permission",
          ];

          const validFormattedData = formattedData.filter(
            (row): row is CsvRow =>
              requiredFields.every(
                (field) => row[field] && row[field].toString().trim() !== ""
              )
          );

          if (validFormattedData.length === 0) {
            reject(
              new Error(
                "No valid data rows found in file. Please check that there are rows with all required information below the header."
              )
            );
            return;
          }

          resolve(validFormattedData);
        } catch (error) {
          reject(
            new Error(
              "Error parsing file. Please make sure you are using a valid file and template format."
            )
          );
        }
      };

      reader.onerror = () => reject(new Error("Error reading file"));

      if (file.name.toLowerCase().endsWith(".csv")) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
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

      const response = await axiosInstance.post("/users/import", previewData);
      const {
        imported,
        skipped,
        errors,
        total: backendTotalProcessed,
        detailedFeedback,
      } = response.data;

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
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <Select
            value={row.original.role}
            onValueChange={(value: Role) =>
              handleRoleChange(row.original.id, value)
            }
            disabled={isRoleUpdating[row.original.id]}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue>
                {isRoleUpdating[row.original.id] ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#124A69]" />
                    <span>Updating...</span>
                  </div>
                ) : (
                  formatEnumValue(row.original.role)
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="FACULTY">Faculty</SelectItem>
              <SelectItem value="ACADEMIC_HEAD">Academic Head</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "permission",
        header: "Permission",
        cell: ({ row }) => (
          <Select
            value={row.original.permission}
            onValueChange={(value: Permission) =>
              handlePermissionChange(row.original.id, value)
            }
            disabled={isPermissionUpdating[row.original.id]}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue>
                {isPermissionUpdating[row.original.id] ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#124A69]" />
                    <span>Updating...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        row.original.permission === "GRANTED"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span>
                      {row.original.permission === "GRANTED"
                        ? "Granted"
                        : "Denied"}
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GRANTED">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Granted</span>
                </div>
              </SelectItem>
              <SelectItem value="DENIED">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Denied</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        ),
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
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={() => setEditingUser(row.original)}
              >
                <Pencil className="h-4 w-4" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 text-red-600"
                onClick={() => {
                  setUserToDelete(row.original);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [
      isRoleUpdating,
      isPermissionUpdating,
      handleRoleChange,
      handlePermissionChange,
      imageMap,
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
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

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

      <div className="relative min-h-[610px] max-h-[610px] flex flex-col">
        <div className="flex-1 rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
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
              {isRefreshing ? (
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
                      <TableCell key={cell.id}>
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

        <div className="flex items-center justify-end w-full mt-2 -mb-3">
          <span className="text-sm text-gray-600 w-1300">
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
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => table.previousPage()}
                  className={
                    !table.getCanPreviousPage()
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
              {Array.from({ length: table.getPageCount() }, (_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    onClick={() => table.setPageIndex(i)}
                    isActive={table.getState().pagination.pageIndex === i}
                    className={
                      table.getState().pagination.pageIndex === i
                        ? "bg-[#124A69] text-white hover:bg-[#0d3a56]"
                        : ""
                    }
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
                      : ""
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
          onClose={() => setEditingUser(null)}
        />
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.name}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-4 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportPreview} onOpenChange={setShowExportPreview}>
        <DialogContent className="w-[90vw] max-w-[800px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#124A69]">
              Export to Excel
            </DialogTitle>
            <DialogDescription>
              Preview of data to be exported:
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 max-h-[400px] overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {EXPECTED_HEADERS.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-sm font-medium text-gray-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.slice(0, MAX_PREVIEW_ROWS).map((user, index) => {
                  return (
                    <tr key={index}>
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
                        {formatEnumValue(user.role)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {user.permission.toLowerCase()}
                      </td>
                    </tr>
                  );
                })}
                {tableData.length > MAX_PREVIEW_ROWS && (
                  <tr className="border-t">
                    <td
                      colSpan={8}
                      className="px-4 py-2 text-sm text-gray-500 text-center"
                    >
                      And {tableData.length - MAX_PREVIEW_ROWS} more users...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end gap-4">
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
              Export to Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showImportPreview} onOpenChange={setShowImportPreview}>
        <DialogContent
          className={`p-4 sm:p-6 h-auto ${
            previewData.length > 0 ? "w-[65vw]" : "w-[25vw]"
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
                <div className="max-h-[350px] overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {EXPECTED_HEADERS.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-2 text-left text-sm font-medium text-gray-500"
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
                            {row["Role"]}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {row["Permission"]}
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
                disabled={!selectedFile || !isValidFile || !!importProgress}
              >
                Import Users
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
                  <div className="border rounded-lg overflow-hidden max-w-[2100px]">
                    <div className="bg-gray-50 p-4 border-b">
                      <h3 className="font-medium text-gray-700">
                        Detailed Import Feedback
                      </h3>
                      <p className="text-sm text-gray-500">
                        Status of each row processed during import.
                      </p>
                    </div>
                    <div className="max-h-[300px] overflow-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                              Row
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                              Email
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                              Status
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
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

      <Toaster />
    </div>
  );
}
