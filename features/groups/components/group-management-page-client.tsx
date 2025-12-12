"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/shared/components/layout/app-sidebar";
import Header from "@/shared/components/layout/header";
import Rightsidebar from "@/shared/components/layout/right-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { format } from "date-fns";
import { GroupHeader } from "@/features/groups/components/group-header";
import toast from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GroupGrid } from "@/features/groups/components/group-grid";
import type { GroupMeta, Group, Course } from "@/features/groups/types";
import { groupsService } from "@/lib/services/client";
import { AttendanceStatus } from "@prisma/client";

interface Student {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  image?: string;
  status: AttendanceStatus | "NOT_SET";
}

interface GroupManagementPageClientProps {
  course: Course;
  initialGroups: Group[];
  initialStudents: Student[];
  initialGroupMeta: GroupMeta;
  courseSlug: string;
}

export function GroupManagementPageClient({
  course,
  initialGroups,
  initialStudents,
  initialGroupMeta,
  courseSlug,
}: GroupManagementPageClientProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [groupMeta, setGroupMeta] = useState<GroupMeta>(initialGroupMeta);
  // Selection state lifted to page so header can control it
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // Filter groups based on search query
  const filteredGroups = groups.filter((group) => {
    const search = searchQuery.toLowerCase();
    return (
      group.number.toLowerCase().includes(search) ||
      (group.name && group.name.toLowerCase().includes(search)) ||
      group.students.some(
        (student) =>
          student.firstName.toLowerCase().includes(search) ||
          student.lastName.toLowerCase().includes(search)
      )
    );
  });

  // Compute all student IDs already in a group
  const excludedStudentIds = groups.flatMap((g) => g.students.map((s) => s.id));

  // Compute next group number (max + 1)
  const maxGroupNumber =
    groups.length > 0
      ? Math.max(...groups.map((g) => Number(g.number) || 0))
      : 0;
  const nextGroupNumber = maxGroupNumber + 1;

  // Function to refresh all data after adding/deleting groups
  const refreshData = async () => {
    try {
      setIsLoading(true);

      // Fetch all data using batched service
      const { groups, students, meta } =
        await groupsService.getCourseWithGroupsData(courseSlug);

      setGroups(groups || []);
      setStudents(students || []);
      setGroupMeta(
        meta || {
          names: [],
          numbers: [],
          usedNames: [],
          usedNumbers: [],
        }
      );
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const deleteSelected = async () => {
    if (selectedGroupIds.length === 0) return;
    setShowBulkDeleteConfirm(false);
    setIsDeletingSelected(true);
    try {
      setIsLoading(true);
      const failed: string[] = [];
      for (const gid of selectedGroupIds) {
        try {
          await groupsService.delete(courseSlug, gid);
        } catch (err) {
          failed.push(gid);
          console.error("failed to delete", gid, err);
        }
      }

      // refresh regardless to show partial success
      await refreshData();

      if (failed.length === 0) {
        toast.success(
          `Deleted ${selectedGroupIds.length} group(s). Grades of students will still remain in the class records.`
        );
      } else if (failed.length < selectedGroupIds.length) {
        toast.success(
          `Deleted ${
            selectedGroupIds.length - failed.length
          } group(s). Some deletions failed. Grades of students will still remain in the class records.`
        );
        toast.error(`${failed.length} group(s) failed to delete`);
      } else {
        toast.error(`Failed to delete selected groups`);
      }
    } finally {
      setIsLoading(false);
      setIsDeletingSelected(false);
      setSelectedGroupIds([]);
      setSelectionMode(false);
    }
  };

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="relative h-screen w-screen overflow-hidden">
        <Header />
        <AppSidebar />

        <main className="h-full w-full xl:w-[calc(100%-22.5rem)] pl-[4rem] sm:pl-[5rem] transition-all overflow-x-auto">
          <div className="flex flex-col flex-grow px-4">
            <div className="flex justify-between gap-4 mb-1 mt-1">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-[#A0A0A0]">
                  Group Management
                </h1>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#A0A0A0]">
                {format(new Date(), "EEEE, MMMM d")}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              <div className="bg-white rounded-lg shadow-md">
                <GroupHeader
                  courseCode={course.code}
                  courseSection={course.section}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  hasNoSearchResults={
                    searchQuery.length > 0 && filteredGroups.length === 0
                  }
                  hasGroups={groups.length > 0}
                  selectionMode={selectionMode}
                  selectedCount={selectedGroupIds.length}
                  onToggleSelectionMode={() => {
                    setSelectionMode((s) => {
                      const next = !s;
                      if (!next) setSelectedGroupIds([]);
                      return next;
                    });
                  }}
                  onDeleteSelected={() => setShowBulkDeleteConfirm(true)}
                  deleting={isDeletingSelected}
                />

                <div className="p-6">
                  <GroupGrid
                    groups={filteredGroups}
                    isLoading={isLoading}
                    courseCode={courseSlug}
                    courseSection={course.section}
                    excludedStudentIds={excludedStudentIds}
                    nextGroupNumber={nextGroupNumber}
                    onGroupAdded={refreshData}
                    students={students}
                    groupMeta={groupMeta}
                    totalStudents={students.length}
                    hasSearchQuery={searchQuery.length > 0}
                    selectionMode={selectionMode}
                    selectedGroupIds={selectedGroupIds}
                    toggleSelectGroup={toggleSelectGroup}
                    deleteSelected={deleteSelected}
                  />
                </div>
                {/* Bulk delete confirmation dialog */}
                <AlertDialog
                  open={showBulkDeleteConfirm}
                  onOpenChange={(open) => {
                    setShowBulkDeleteConfirm(open);
                    if (!open) {
                      document.body.style.removeProperty("pointer-events");
                    }
                  }}
                >
                  <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-[#124A69] text-xl font-bold">
                        Delete {selectedGroupIds.length} selected group(s)?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-500">
                        This action will permanently delete the selected groups.
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-2">
                      <AlertDialogCancel
                        onClick={() => setShowBulkDeleteConfirm(false)}
                        className="border-gray-200"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteSelected()}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={isDeletingSelected}
                      >
                        {isDeletingSelected ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          <Rightsidebar />
        </main>
      </div>
    </SidebarProvider>
  );
}
