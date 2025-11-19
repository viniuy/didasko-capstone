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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

  const handleActionToggle = (action: string) => {
    onFiltersChange({
      ...filters,
      actions: filters.actions.includes(action)
        ? filters.actions.filter((a) => a !== action)
        : [...filters.actions, action],
    });
  };

  const handleFacultyToggle = (facultyId: string) => {
    onFiltersChange({
      ...filters,
      faculty: filters.faculty.includes(facultyId)
        ? filters.faculty.filter((f) => f !== facultyId)
        : [...filters.faculty, facultyId],
    });
  };

  const handleModuleToggle = (module: string) => {
    onFiltersChange({
      ...filters,
      modules: filters.modules.includes(module)
        ? filters.modules.filter((m) => m !== module)
        : [...filters.modules, module],
    });
  };

  const handleClearAll = () => {
    onFiltersChange({
      actions: [],
      faculty: [],
      modules: [],
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters =
    filters.actions.length > 0 ||
    filters.faculty.length > 0 ||
    filters.modules.length > 0 ||
    filters.startDate !== undefined ||
    filters.endDate !== undefined;

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
          {/* Action Filter */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-700">Action</Label>
            <div className="space-y-3 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
              {availableActions.length === 0 ? (
                <p className="text-sm text-gray-500">No actions available</p>
              ) : (
                availableActions.map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.actions.includes(action)}
                      onChange={() => handleActionToggle(action)}
                      className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
                    />
                    <span className="text-sm">
                      {action
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

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
                  <label
                    key={fac.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.faculty.includes(fac.id)}
                      onChange={() => handleFacultyToggle(fac.id)}
                      className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
                    />
                    <span className="text-sm">
                      {fac.name || fac.email || "Unknown"}
                    </span>
                  </label>
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
                  <label
                    key={module}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.modules.includes(module)}
                      onChange={() => handleModuleToggle(module)}
                      className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
                    />
                    <span className="text-sm">{module}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-700">
              Date Range
            </Label>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-[#124A69]",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? (
                        format(filters.startDate, "PPP")
                      ) : (
                        <span>Pick a start date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => {
                        onFiltersChange({
                          ...filters,
                          startDate: date,
                        });
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-[#124A69]",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? (
                        format(filters.endDate, "PPP")
                      ) : (
                        <span>Pick an end date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => {
                        onFiltersChange({
                          ...filters,
                          endDate: date,
                        });
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
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
              onFiltersChange({
                actions: [],
                faculty: [],
                modules: [],
                startDate: undefined,
                endDate: undefined,
              });
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-lg bg-[#124A69] hover:bg-[#0D3A54]"
            onClick={onApplyFilters}
          >
            Apply
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
