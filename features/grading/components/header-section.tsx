import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Search, Filter, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface HeaderSectionProps {
  courseCode: string;
  courseSection: string;
  selectedDate: Date | undefined;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onFilterClick: () => void;
  onDateSelect: (date: Date | undefined) => void;
  onManageReport: () => void;
  filterCount: number;
  onBackClick: () => void;
  gradeDates?: string[]; // Dates where grades exist (for highlighting)
  hasActiveReport?: boolean; // Whether criteria is already selected
  isRecitationCriteria?: boolean; // Whether this is recitation criteria
  isLoading?: boolean; // Whether students/grades are loading
}

export function HeaderSection({
  courseCode,
  courseSection,
  selectedDate,
  searchQuery,
  onSearchChange,
  onFilterClick,
  onDateSelect,
  onManageReport,
  filterCount,
  onBackClick,
  gradeDates = [],
  hasActiveReport = false,
  isRecitationCriteria = false,
  isLoading = false,
}: HeaderSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Button
          variant="ghost"
          className="h-9 w-9 p-0 hover:bg-gray-100"
          onClick={onBackClick}
        >
          <svg
            className="h-5 w-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Button>
        <div className="flex flex-col mr-4">
          <span className="text-lg font-bold text-[#124A69] leading-tight">
            {courseCode}
          </span>
          <span className="text-sm text-gray-500">{courseSection}</span>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 w-[200px]"
                disabled={isLoading}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  &#10005;
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full relative flex items-center gap-2 px-3 bg-white text-[#124A69] hover:bg-gray-100 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onFilterClick}
              disabled={isLoading}
            >
              <Filter className="h-4 w-4" />
              <span>Filter</span>
              {filterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#124A69] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled
                className={cn(
                  "w-[230px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  onDateSelect(date);
                }}
                modifiers={{
                  hasGrades: gradeDates.map((dateStr) => {
                    // Parse YYYY-MM-DD as local time (Philippines time, not UTC)
                    // Use noon to avoid timezone edge cases when converting
                    const [year, month, day] = dateStr.split("-").map(Number);
                    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
                    return date;
                  }),
                }}
                modifiersClassNames={{
                  hasGrades:
                    "bg-blue-100 text-blue-800 font-semibold rounded-md",
                }}
                className="rounded-md border"
                initialFocus
              />
              {gradeDates.length > 0 && (
                <div className="p-3 border-t text-xs text-gray-500 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                    <span>
                      Dates with grades for this criteria ({gradeDates.length})
                    </span>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button
            onClick={onManageReport}
            className="ml-2 h-9 px-4 bg-[#124A69] text-white rounded shadow flex items-center"
          >
            {isRecitationCriteria ? "Manage Criteria" : "Manage Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}
