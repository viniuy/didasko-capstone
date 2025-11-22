"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";

interface Faculty {
  id: string;
  name: string | null;
  email: string | null;
}

interface AuditLogsFilterState {
  actions: string[];
  faculty: string[];
  modules: string[];
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface AuditLogsFilterSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AuditLogsFilterState;
  onFiltersChange: (filters: AuditLogsFilterState) => void;
  onApplyFilters: () => void;
  availableActions: string[];
  availableModules: string[];
  availableFaculty?: Faculty[];
  isLoadingFaculty?: boolean;
}

export function AuditLogsFilterSheet({
  isOpen,
  onOpenChange,
  filters,
  onFiltersChange,
  onApplyFilters,
  availableActions,
  availableModules,
  availableFaculty = [],
  isLoadingFaculty = false,
}: AuditLogsFilterSheetProps) {
  // Use faculty from props
  const faculty = availableFaculty;

  // Local state for temporary filter changes (not applied until "Apply" is clicked)
  const [localFilters, setLocalFilters] =
    useState<AuditLogsFilterState>(filters);

  // Sync local filters with props when sheet opens or filters change externally
  useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
    }
  }, [filters, isOpen]);

  const handleActionToggle = (action: string) => {
    setLocalFilters({
      ...localFilters,
      actions: localFilters.actions.includes(action)
        ? localFilters.actions.filter((a) => a !== action)
        : [...localFilters.actions, action],
    });
  };

  const handleFacultyToggle = (facultyId: string) => {
    setLocalFilters({
      ...localFilters,
      faculty: localFilters.faculty.includes(facultyId)
        ? localFilters.faculty.filter((f) => f !== facultyId)
        : [...localFilters.faculty, facultyId],
    });
  };

  const handleModuleToggle = (module: string) => {
    setLocalFilters({
      ...localFilters,
      modules: localFilters.modules.includes(module)
        ? localFilters.modules.filter((m) => m !== module)
        : [...localFilters.modules, module],
    });
  };

  const handleClearAll = () => {
    setLocalFilters({
      actions: [],
      faculty: [],
      modules: [],
      startDate: undefined,
      endDate: undefined,
    });
  };

  const handleApply = () => {
    // Apply local filters to parent component
    onFiltersChange(localFilters);
    onApplyFilters();
  };

  const hasActiveFilters =
    localFilters.actions.length > 0 ||
    localFilters.faculty.length > 0 ||
    localFilters.modules.length > 0 ||
    localFilters.startDate !== undefined ||
    localFilters.endDate !== undefined;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[540px] p-0 overflow-y-auto"
      >
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle className="text-xl font-semibold">
              Filter Options
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Faculty Filter */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-700">Faculty</Label>
            <div className="space-y-3 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
              {isLoadingFaculty ? (
                <p className="text-sm text-gray-500">Loading faculty...</p>
              ) : faculty.length === 0 ? (
                <p className="text-sm text-gray-500">No faculty available</p>
              ) : (
                faculty.map((fac) => (
                  <div
                    key={fac.id}
                    className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors"
                  >
                    <Checkbox
                      id={`faculty-${fac.id}`}
                      checked={localFilters.faculty.includes(fac.id)}
                      onCheckedChange={() => handleFacultyToggle(fac.id)}
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <Label
                      htmlFor={`faculty-${fac.id}`}
                      className="text-sm cursor-pointer text-gray-700 hover:text-[#124A69] transition-colors"
                    >
                      {fac.name || fac.email || "Unknown"}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Filter */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-700">Action</Label>
            <div className="space-y-3 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
              {availableActions.length === 0 ? (
                <p className="text-sm text-gray-500">No actions available</p>
              ) : (
                availableActions.map((action) => (
                  <div
                    key={action}
                    className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors"
                  >
                    <Checkbox
                      id={`action-${action}`}
                      checked={localFilters.actions.includes(action)}
                      onCheckedChange={() => handleActionToggle(action)}
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <Label
                      htmlFor={`action-${action}`}
                      className="text-sm cursor-pointer text-gray-700 hover:text-[#124A69] transition-colors"
                    >
                      {action
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Module Filter */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-700">Module</Label>
            <div className="space-y-3 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
              {availableModules.length === 0 ? (
                <p className="text-sm text-gray-500">No modules available</p>
              ) : (
                availableModules.map((module) => (
                  <div
                    key={module}
                    className="flex items-center space-x-2 p-1.5 rounded hover:bg-[#124A69]/5 transition-colors"
                  >
                    <Checkbox
                      id={`module-${module}`}
                      checked={localFilters.modules.includes(module)}
                      onCheckedChange={() => handleModuleToggle(module)}
                      className="data-[state=checked]:bg-[#124A69] data-[state=checked]:border-[#124A69] border-[#124A69]/30"
                    />
                    <Label
                      htmlFor={`module-${module}`}
                      className="text-sm cursor-pointer text-gray-700 hover:text-[#124A69] transition-colors"
                    >
                      {module}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-6 border-t mt-auto">
          <Button
            variant="outline"
            className="flex-1 rounded-lg"
            onClick={handleClearAll}
            disabled={!hasActiveFilters}
          >
            Clear All
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-lg"
            onClick={() => {
              // Reset local filters to current applied filters on cancel
              setLocalFilters(filters);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-lg bg-[#124A69] hover:bg-[#0D3A54]"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
