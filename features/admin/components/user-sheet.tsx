"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserStatus, Role, WorkType } from "@prisma/client";
import { addUser } from "@/lib/actions/users";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

// Available departments
const DEPARTMENTS = ["IT Department", "BA Department", "HM Department"];

const userSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .refine(
      (val) => val.trim().length > 0,
      "Name cannot be empty or only spaces"
    )
    .refine((val) => !val.startsWith(" "), "Name cannot start with a space"),
  email: z
    .string()
    .email("Invalid email address")
    .refine(
      (email) => email.endsWith("@alabang.sti.edu.ph"),
      "Email must be from alabang.sti.edu.ph domain"
    ),
  department: z.string().min(1, "Department is required"),
  workType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]),
  role: z.enum(["ADMIN", "FACULTY", "ACADEMIC_HEAD"]),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});

interface UserSheetProps {
  mode: "add" | "edit";
  user?: {
    id: string;
    name: string;
    email: string;
    department: string;
    workType: WorkType;
    role: Role;
    status: UserStatus;
  };
  onSuccess?: () => Promise<void> | void;
  onClose?: () => void;
  onSave?: (
    userId: string,
    data: {
      name?: string;
      email?: string;
      department?: string;
      workType?: WorkType;
      role?: Role;
      status?: UserStatus;
    }
  ) => Promise<void>;
}

export function UserSheet({
  mode,
  user,
  onSuccess,
  onClose,
  onSave,
}: UserSheetProps) {
  const [open, setOpen] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialFormData = {
    name: mode === "edit" ? user?.name || "" : "",
    email: mode === "edit" ? user?.email || "" : "",
    department:
      mode === "edit" ? user?.department || DEPARTMENTS[0] : DEPARTMENTS[0],
    workType: mode === "edit" ? user?.workType || "FULL_TIME" : "FULL_TIME",
    role: mode === "edit" ? user?.role || "FACULTY" : "FACULTY",
    status: mode === "edit" ? user?.status || "ACTIVE" : "ACTIVE",
  };

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: initialFormData,
  });

  const onSubmit = async (values: z.infer<typeof userSchema>) => {
    const toastId = toast.loading(
      mode === "add" ? "Adding user..." : "Updating user..."
    );

    try {
      setIsSubmitting(true);

      if (mode === "add") {
        const result = await addUser(values);

        if (result.success) {
          toast.success("User added successfully!", { id: toastId });
          form.reset();
          setOpen(false);
          if (onSuccess) {
            await onSuccess();
          }
        } else {
          toast.error(result.error || "Failed to add user", { id: toastId });
        }
      } else if (mode === "edit" && user && onSave) {
        await onSave(user.id, {
          name: values.name,
          email: values.email,
          department: values.department,
          workType: values.workType,
          role: values.role,
          status: values.status,
        });
        toast.success("User updated successfully!", { id: toastId });
        setOpen(false);
        if (onSuccess) {
          await onSuccess();
        }
      }
    } catch (error) {
      console.error(
        `Error ${mode === "add" ? "adding" : "updating"} user:`,
        error
      );
      toast.error(
        `Failed to ${
          mode === "add" ? "add" : "update"
        } user. Please try again.`,
        { id: toastId }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset(initialFormData);
    setOpen(false);
    document.body.style.pointerEvents = "";
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = "";
    };
  }, []);

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          setOpen(true);
        }
      }}
    >
      {mode === "add" && (
        <SheetTrigger asChild>
          <Button className="ml-auto bg-[#124A69] text-white hover:bg-gray-700">
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="right" className="sm:max-w-md p-4 flex flex-col">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-3xl font-semibold text-[#124A69] tracking-tight">
            {mode === "add" ? "Add User" : "Edit User"}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 py-4 flex-1 flex flex-col"
        >
          <div className="flex-1">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Enter full name"
                  className={form.formState.errors.name ? "border-red-500" : ""}
                  maxLength={100}
                />
                <div className="flex justify-between">
                  <div className="text-xs text-muted-foreground">
                    {form.watch("name").length}/100
                  </div>
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">
                  School Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  placeholder="email@alabang.sti.edu.ph"
                  className={
                    form.formState.errors.email ? "border-red-500" : ""
                  }
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="flex flex-row gap-2">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="department">
                    Department <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("department", value)
                    }
                    defaultValue={form.getValues("department")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.department && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.department.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <Label htmlFor="workType">
                    Work Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("workType", value as WorkType)
                    }
                    defaultValue={form.getValues("workType")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select work type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WorkType.FULL_TIME}>
                        Full Time
                      </SelectItem>
                      <SelectItem value={WorkType.PART_TIME}>
                        Part Time
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.workType && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.workType.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-row gap-2">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="role">
                    Role <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("role", value as Role)
                    }
                    defaultValue={form.getValues("role")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Role.FACULTY}>Faculty</SelectItem>
                      <SelectItem value={Role.ADMIN}>Admin</SelectItem>
                      <SelectItem value={Role.ACADEMIC_HEAD}>
                        Academic Head
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.role && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.role.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <Label htmlFor="status">
                    Status <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("status", value as UserStatus)
                    }
                    defaultValue={form.getValues("status")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UserStatus.ACTIVE}>Active</SelectItem>
                      <SelectItem value={UserStatus.ARCHIVED}>
                        Archived
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.status && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.status.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#124A69] text-white hover:bg-gray-700"
            >
              {isSubmitting
                ? mode === "add"
                  ? "Adding..."
                  : "Saving..."
                : mode === "add"
                ? "Add"
                : "Save Changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
