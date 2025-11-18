"use client";

import {
  Home,
  LayoutDashboard,
  LogOut,
  CalendarCheck,
  ClipboardList,
  ChevronDown,
  Presentation,
  NotebookPen,
  BookCheck,
  CalendarClock,
  BookUser,
  BookOpen,
  Users,
  BookCopy,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import EditProfileModal from "@/shared/components/profile/components/EditProfileModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSession, signOut } from "next-auth/react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { usePathname, useRouter } from "next/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";

const adminItems = [
  { title: "Dashboard", url: "/dashboard/admin", icon: LayoutDashboard },
  { title: "Courses", url: "/main/course", icon: BookOpen },
  { title: "Students", url: "/main/students", icon: Users },
  { title: "Audit Logs", url: "/main/logs", icon: Activity },
];

const academicHeadItems = [
  {
    title: "Dashboard",
    url: "/dashboard/academic-head",
    icon: LayoutDashboard,
  },
  { title: "Courses", url: "/main/course", icon: BookOpen },
  { title: "Faculty Load", url: "/main/faculty-load", icon: CalendarClock },
  { title: "Attendance", url: "/main/attendance", icon: CalendarCheck },
  { title: "Audit Logs", url: "/main/logs", icon: Activity },
];

const facultyItems = [
  { title: "Dashboard", url: "/dashboard/faculty", icon: LayoutDashboard },
  { title: "Courses", url: "/main/course", icon: BookOpen },
  { title: "Attendance", url: "/main/attendance", icon: CalendarCheck },
];

const gradingSubItems = [
  { title: "Class Record", url: "/main/grading/class-record", icon: BookUser },
  { title: "Reporting", url: "/main/grading/reporting", icon: Presentation },
  { title: "Recitation", url: "/main/grading/recitation", icon: BookCheck },
];

function SidebarSkeleton() {
  return (
    <Sidebar
      collapsible="icon"
      className="h-screen flex flex-col bg-[#124A69] text-white"
    >
      <SidebarContent className="flex-1">
        {/* User Profile Skeleton */}
        <SidebarHeader className="flex flex-row items-center gap-3 px-2 mt-4">
          <div className="space-y-2">
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </SidebarHeader>

        {/* Menu Items Skeleton */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {[1, 2, 3, 4].map((i) => (
                <SidebarMenuItem key={i}>
                  <div className="flex items-center gap-3 p-3 rounded w-full">
                    <Skeleton className="w-6 h-6" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Skeleton */}
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 p-3 rounded">
          <Skeleton className="w-6 h-6" />
          <Skeleton className="h-4 w-16" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar() {
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const { open, setOpen } = useSidebar();
  const { data: session, status, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Define allowed paths for each role
  const allowedPaths = {
    ADMIN: [
      "/dashboard/admin",
      "/main/course",
      "/main/accounts",
      "/main/students",
      "/main/logs",
    ],
    ACADEMIC_HEAD: [
      "/dashboard/academic-head",
      "/main/attendance",
      "/main/faculty-load",
      "/main/grading/class-record",
      "/main/grading/reporting",
      "/main/grading/recitation",
      "/main/course",
      "/main/logs",
    ],
    FACULTY: [
      "/dashboard/faculty",
      "/main/attendance",
      "/main/grading/class-record",
      "/main/grading/reporting",
      "/main/grading/recitation",
      "/main/course",
    ],
  };
  const [userImage, setUserImage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) setIsGradingOpen(false);
  }, [open]);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchUserImage = async () => {
      if (!session?.user?.id) return;

      const bucket = supabase.storage.from("user-images");
      const possibleFiles = [`${session.user.id}.png`];

      for (const filename of possibleFiles) {
        const { data } = bucket.getPublicUrl(filename);
        try {
          const res = await fetch(data.publicUrl, { method: "HEAD" });
          if (res.ok) {
            setUserImage(`${data.publicUrl}?t=${Date.now()}`);
            return;
          }
        } catch (err) {
          console.error("Error checking image:", err);
        }
      }

      // fallback
      setUserImage(session?.user?.image || undefined);
    };

    fetchUserImage();
  }, [session?.user?.id]);

  // Immediate path check and redirect
  useEffect(() => {
    const role = session?.user?.role;
    const selectedRole = session?.user?.selectedRole;
    const currentPath = pathname;

    // If we have a role, check if the path is allowed
    if (role) {
      // For admins, use selectedRole if available, otherwise use their actual role
      const effectiveRole =
        role === "ADMIN" && selectedRole ? selectedRole : role;

      const isPathAllowed = allowedPaths[
        effectiveRole as keyof typeof allowedPaths
      ]?.some((path) => currentPath?.startsWith(path));

      if (!isPathAllowed) {
        switch (effectiveRole) {
          case "ADMIN":
            router.push("/dashboard/admin");
            break;
          case "ACADEMIC_HEAD":
            router.push("/dashboard/academic-head");
            break;
          case "FACULTY":
            router.push("/dashboard/faculty");
            break;
          default:
            router.push("/");
        }
      }
    } else if (status === "unauthenticated") {
      // If not authenticated, redirect to home
      router.push("/");
    }
  }, [
    pathname,
    session?.user?.role,
    session?.user?.selectedRole,
    status,
    router,
  ]);

  const isAdmin = session?.user?.role === "ADMIN";
  const selectedRole = session?.user?.selectedRole;
  const isAcademicHead = session?.user?.role === "ACADEMIC_HEAD";
  const isFaculty = session?.user?.role === "FACULTY";

  // For admins, show menu items based on selectedRole if available
  let items = adminItems;
  if (isAcademicHead) {
    items = academicHeadItems;
  } else if (isFaculty || (isAdmin && selectedRole === "FACULTY")) {
    items = facultyItems;
  } else if (isAdmin && selectedRole === "ADMIN") {
    items = adminItems;
  }

  const handleRoleSwitch = async (newRole: "ADMIN" | "FACULTY") => {
    try {
      // Store in localStorage
      localStorage.setItem("admin_selected_role", newRole);

      // Update the session
      await update({
        selectedRole: newRole,
      });

      // Redirect to the appropriate dashboard
      const roleMap: Record<string, string> = {
        ADMIN: "/dashboard/admin",
        FACULTY: "/dashboard/faculty",
      };
      router.push(roleMap[newRole]);
    } catch (error) {
      console.error("Role switch error:", error);
      toast.error("Failed to switch role");
    }
  };

  const handleLogout = async () => {
    try {
      const loadingToast = toast.loading("Logging out...");

      // Log logout before clearing session
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
        });
      } catch (error) {
        console.error("Logout logging error:", error);
        // Continue with logout even if logging fails
      }

      // Clear the selected role from localStorage
      localStorage.removeItem("admin_selected_role");

      // First, clean up our session
      await fetch("/api/auth/session", {
        method: "DELETE",
      });

      // Then sign out from NextAuth
      await signOut({
        redirect: false,
      });

      // Finally, redirect to home page
      router.push("/");
      toast.dismiss(loadingToast);
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
      // If NextAuth signOut fails, still try to redirect manually
      router.push("/");
    }
  };

  if (status === "loading") {
    return <SidebarSkeleton />;
  }

  const displayName = session?.user?.name || "Loading...";
  const displayDepartment = isAdmin
    ? "Administrator"
    : isAcademicHead
    ? "Academic Head"
    : isFaculty
    ? "Faculty"
    : "";
  const avatarInitial = displayName.charAt(0);
  const user = {
    name: session?.user?.name || "Unknown User",
    role: session?.user?.role || "",
    id: session?.user?.id || "",
    department: displayDepartment,
    image: userImage || null,
  };
  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="fixed top-0 left-0 z-50 h-screen bg-[#124A69] text-white border-[#124A69]"
    >
      <SidebarContent className="flex-1">
        {/* User Profile */}
        <SidebarHeader className="flex flex-row items-center gap-3 px-2 mt-4 relative group">
          <div className="relative">
            <Avatar className="w-12 h-12 shrink-0">
              <AvatarImage src={userImage} className="object-cover" />
              <AvatarFallback className="text-xl">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>

            {/* Pencil overlay on hover */}
            <button
              onClick={() => setEditModalOpen(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"
            >
              <NotebookPen className="w-5 h-5 text-white" />
            </button>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 delay-150 ${
              open
                ? "opacity-100 translate-x-0 w-auto"
                : "opacity-0 translate-x-[-10px] w-0"
            }`}
          >
            <p
              className="text-lg font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]"
              title={displayName}
            >
              {displayName}
            </p>
            <p
              className="text-sm text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]"
              title={displayDepartment}
            >
              {displayDepartment}
            </p>
          </div>
        </SidebarHeader>

        {/* Sidebar Menu */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <a
                    href={item.url}
                    className={`flex items-center gap-3 p-3 rounded hover:bg-gray-800 w-full ${
                      pathname?.startsWith(item.url) ? "bg-gray-800" : ""
                    }`}
                  >
                    <item.icon className="w-6 h-6 shrink-0" />
                    <span
                      className={`whitespace-nowrap transition-all duration-300 ${
                        open
                          ? "opacity-100 translate-x-0 delay-200"
                          : "opacity-0 translate-x-[-10px] delay-0"
                      }`}
                    >
                      {open && item.title}
                    </span>
                  </a>
                </SidebarMenuItem>
              ))}

              {!isAdmin && (
                <>
                  <SidebarMenuItem>
                    <Collapsible
                      open={isGradingOpen}
                      onOpenChange={setIsGradingOpen}
                      className="group/collapsible w-full"
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          className={`flex items-center gap-3 p-3 rounded hover:bg-gray-800 w-full ${
                            pathname?.startsWith("/grading")
                              ? "bg-gray-800"
                              : ""
                          }`}
                        >
                          <ClipboardList className="w-6 h-6 shrink-0" />
                          <span
                            className={`whitespace-nowrap transition-all duration-300 ${
                              open
                                ? "opacity-100 translate-x-0 delay-200"
                                : "opacity-0 translate-x-[-10px] delay-0"
                            }`}
                          >
                            {open && "Grading"}
                          </span>
                          <ChevronDown
                            className={`ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180 ${
                              open ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {gradingSubItems.map((item) => (
                              <SidebarMenuItem key={item.title}>
                                <a
                                  href={item.url}
                                  className={`flex items-center gap-3 p-3 rounded hover:bg-gray-800 w-56 h-10 ml-4 ${
                                    pathname?.startsWith(item.url)
                                      ? "bg-gray-800"
                                      : ""
                                  }`}
                                >
                                  <item.icon className="w-6 h-6 shrink-0" />
                                  <span
                                    className={`text-sm transition-all duration-1000 ${
                                      open
                                        ? "opacity-100 translate-x-0 "
                                        : "opacity-0 translate-x-[-10px]"
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                </a>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Logout Button in Sidebar Footer */}
      <SidebarFooter className="p-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-3 p-3 rounded hover:bg-gray-800 text-black-600">
              <LogOut className="w-6 h-6 shrink-0" />
              <span
                className={`transition-all duration-300 ${
                  open
                    ? "opacity-100 translate-x-0 delay-200"
                    : "opacity-0 translate-x-[-10px] delay-0"
                }`}
              >
                {open && "Logout"}
              </span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-semibold">
                {isAdmin
                  ? "What would you like to do?"
                  : "Are you sure you want to logout?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                {isAdmin
                  ? selectedRole === "FACULTY"
                    ? "You can switch back to Admin view or logout completely."
                    : "You can switch to Faculty view or logout completely."
                  : "This action will log you out of your account."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
              <AlertDialogCancel
                onClick={() => setOpen(false)}
                className="border-0 bg-gray-100 hover:bg-gray-200 text-gray-900 w-full sm:w-auto"
              >
                Cancel
              </AlertDialogCancel>
              {isAdmin && (
                <AlertDialogAction
                  onClick={() => {
                    const newRole =
                      selectedRole === "FACULTY" ? "ADMIN" : "FACULTY";
                    handleRoleSwitch(newRole);
                    setOpen(false);
                  }}
                  className="bg-[#124A69] hover:bg-[#0a2f42] text-white w-full sm:w-auto"
                >
                  {selectedRole === "FACULTY"
                    ? "Switch to Admin"
                    : "Switch to Faculty"}
                </AlertDialogAction>
              )}
              <AlertDialogAction
                onClick={() => {
                  handleLogout();
                  setOpen(false);
                }}
                className="bg-[#124A69] hover:bg-[#0a2f42] text-white w-full sm:w-auto"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarFooter>
      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        user={user}
      />
    </Sidebar>
  );
}
