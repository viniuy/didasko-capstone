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
import { useSession } from "next-auth/react";
import { useBreakGlassStatus, useUsers } from "@/lib/hooks/queries";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEPARTMENTS } from "@/lib/constants/departments";

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
  roles: z
    .array(z.enum(["ADMIN", "FACULTY", "ACADEMIC_HEAD"]))
    .min(1, "At least one role is required"),
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
    roles: Role[];
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
      roles?: Role[];
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
  const { data: session } = useSession();
  const [open, setOpen] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if current user is temporary admin using React Query
  const { data: breakGlassData } = useBreakGlassStatus(session?.user?.id);
  const isCurrentUserTempAdmin = !!breakGlassData?.isActive;

  // Fetch all users to check if user is the last admin/academic head
  const { data: allUsersData } = useUsers();
  const allUsers: Array<{
    id: string;
    roles?: Role[];
  }> = Array.isArray(allUsersData) ? allUsersData : allUsersData?.users || [];

  const initialFormData: z.infer<typeof userSchema> = {
    name: mode === "edit" ? user?.name || "" : "",
    email: mode === "edit" ? user?.email || "" : "",
    department:
      mode === "edit" ? user?.department || DEPARTMENTS[0] : DEPARTMENTS[0],
    workType:
      mode === "edit"
        ? (user?.workType as "FULL_TIME" | "PART_TIME" | "CONTRACT") ||
          "FULL_TIME"
        : "FULL_TIME",
    roles:
      mode === "edit"
        ? (user?.roles as ("ADMIN" | "FACULTY" | "ACADEMIC_HEAD")[]) || [
            "FACULTY",
          ]
        : ["FACULTY"],
    status:
      mode === "edit"
        ? (user?.status as "ACTIVE" | "ARCHIVED") || "ACTIVE"
        : "ACTIVE",
  };

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: initialFormData,
  });

  // Reset form and open sheet when user prop changes (for edit mode)
  useEffect(() => {
    if (mode === "edit" && user) {
      setOpen(true);
      form.reset({
        name: user.name || "",
        email: user.email || "",
        department: user.department || DEPARTMENTS[0],
        workType:
          (user.workType as "FULL_TIME" | "PART_TIME" | "CONTRACT") ||
          "FULL_TIME",
        roles: (user.roles as ("ADMIN" | "FACULTY" | "ACADEMIC_HEAD")[]) || [
          "FACULTY",
        ],
        status: (user.status as "ACTIVE" | "ARCHIVED") || "ACTIVE",
      });
    } else if (mode === "add") {
      // Reset form for add mode
      form.reset({
        name: "",
        email: "",
        department: DEPARTMENTS[0],
        workType: "FULL_TIME",
        roles: ["FACULTY"],
        status: "ACTIVE",
      });
    }
  }, [user?.id, mode, form]);

  const onSubmit = async (values: z.infer<typeof userSchema>) => {
    const toastId = toast.loading(
      mode === "add" ? "Adding user..." : "Updating user..."
    );

    try {
      setIsSubmitting(true);

      // Prevent temporary admins from adding users with ADMIN or ACADEMIC_HEAD roles
      if (isCurrentUserTempAdmin && mode === "add") {
        const hasAdminOrHeadRole =
          values.roles.includes(Role.ADMIN) ||
          values.roles.includes(Role.ACADEMIC_HEAD);

        if (hasAdminOrHeadRole) {
          toast.error(
            "Temporary admins cannot add users with Admin or Academic Head roles",
            { id: toastId }
          );
          setIsSubmitting(false);
          return;
        }
      }

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
          // Don't update roles and status in edit mode - they're managed in the table
          // roles: values.roles,
          // status: values.status,
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

  // Function to remove emojis from text
  const removeEmojis = (text: string): string => {
    // Remove emojis using regex pattern
    // This pattern matches most emoji ranges in Unicode
    return text.replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE00}-\u{FE0F}]|[\u{20D0}-\u{20FF}]/gu,
      ""
    );
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
                  {...form.register("name", {
                    onChange: (e) => {
                      const cleanedValue = removeEmojis(e.target.value);
                      if (cleanedValue !== e.target.value) {
                        form.setValue("name", cleanedValue, {
                          shouldValidate: true,
                        });
                      }
                    },
                  })}
                  placeholder="Enter full name"
                  className={form.formState.errors.name ? "border-red-500" : ""}
                  maxLength={100}
                  disabled={isSubmitting}
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
                  {...form.register("email", {
                    onChange: (e) => {
                      const cleanedValue = removeEmojis(e.target.value);
                      if (cleanedValue !== e.target.value) {
                        form.setValue("email", cleanedValue, {
                          shouldValidate: true,
                        });
                      }
                    },
                  })}
                  placeholder="email@alabang.sti.edu.ph"
                  className={
                    form.formState.errors.email ? "border-red-500" : ""
                  }
                  disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
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

              {mode === "add" && (
                <div className="flex flex-row gap-2">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="roles">
                      Roles <span className="text-red-500">*</span>
                    </Label>
                    <div className="space-y-2 border rounded-md p-3">
                      {[
                        { value: Role.FACULTY, label: "Faculty" },
                        { value: Role.ADMIN, label: "Admin" },
                        { value: Role.ACADEMIC_HEAD, label: "Academic Head" },
                      ]
                        .filter((role) => {
                          // In add mode, hide ADMIN/ACADEMIC_HEAD for temp admins
                          if (isCurrentUserTempAdmin && mode === "add") {
                            return role.value === Role.FACULTY;
                          }
                          return true;
                        })
                        .map((role) => {
                          const currentRoles = form.watch("roles") || [];
                          const isChecked = currentRoles.includes(role.value);
                          const isAdminOrHead =
                            role.value === Role.ADMIN ||
                            role.value === Role.ACADEMIC_HEAD;

                          return (
                            <div
                              key={role.value}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`role-${role.value}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const currentRoles =
                                    form.getValues("roles") || [];
                                  if (checked) {
                                    if (
                                      isCurrentUserTempAdmin &&
                                      isAdminOrHead
                                    ) {
                                      toast.error(
                                        "Temporary admins cannot assign Admin or Academic Head roles"
                                      );
                                      return;
                                    }
                                    // Prevent having both ADMIN and ACADEMIC_HEAD roles
                                    if (
                                      role.value === Role.ADMIN &&
                                      currentRoles.includes(Role.ACADEMIC_HEAD)
                                    ) {
                                      toast.error(
                                        "A user cannot have both Admin and Academic Head roles. Please remove Academic Head role first."
                                      );
                                      return;
                                    }
                                    if (
                                      role.value === Role.ACADEMIC_HEAD &&
                                      currentRoles.includes(Role.ADMIN)
                                    ) {
                                      toast.error(
                                        "A user cannot have both Admin and Academic Head roles. Please remove Admin role first."
                                      );
                                      return;
                                    }
                                    form.setValue("roles", [
                                      ...currentRoles,
                                      role.value,
                                    ]);
                                  } else {
                                    form.setValue(
                                      "roles",
                                      currentRoles.filter(
                                        (r) => r !== role.value
                                      )
                                    );
                                  }
                                }}
                                disabled={
                                  isSubmitting ||
                                  (isCurrentUserTempAdmin && isAdminOrHead)
                                }
                                className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]"
                              />
                              <label
                                htmlFor={`role-${role.value}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {role.label}
                              </label>
                            </div>
                          );
                        })}
                    </div>
                    {form.formState.errors.roles && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.roles.message}
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
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UserStatus.ACTIVE}>
                          Active
                        </SelectItem>
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
              )}
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
