import { Button } from "@/components/ui/button";
import {
  FilterState,
  AttendanceStatusWithNotSet,
} from "@/shared/types/attendance";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FilterSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApplyFilters: () => void;
  statusLabels?: {
    [key in AttendanceStatusWithNotSet]: string;
  };
}

export function FilterSheet({
  isOpen,
  onOpenChange,
  filters,
  onFiltersChange,
  onApplyFilters,
  statusLabels,
}: FilterSheetProps) {
  const getStatusDisplay = (status: AttendanceStatusWithNotSet) => {
    if (statusLabels?.[status]) {
      return statusLabels[status];
    }
    switch (status) {
      case "PRESENT":
        return "Present";
      case "LATE":
        return "Late";
      case "ABSENT":
        return "Absent";
      case "EXCUSED":
        return "Excused";
      case "NOT_SET":
        return "No Status";
      default:
        return "Status";
    }
  };

  const statusValues: AttendanceStatusWithNotSet[] = [
    "PRESENT",
    "LATE",
    "ABSENT",
    "EXCUSED",
    "NOT_SET",
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle className="text-xl font-semibold">
              Filter Options
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Attendance Status Filter */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-700">
              Attendance Status
            </label>
            <div className="space-y-3 border rounded-lg p-4">
              {statusValues.map((status) => (
                <label
                  key={status}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.status.includes(
                      status as AttendanceStatusWithNotSet
                    )}
                    onChange={(e) => {
                      onFiltersChange({
                        ...filters,
                        status: e.target.checked
                          ? [
                              ...filters.status,
                              status as AttendanceStatusWithNotSet,
                            ]
                          : filters.status.filter(
                              (s) =>
                                s !== (status as AttendanceStatusWithNotSet)
                            ),
                      });
                    }}
                    className="rounded border-gray-300 text-[#124A69] focus:ring-[#124A69]"
                  />
                  <span className="text-sm">
                    {getStatusDisplay(status as AttendanceStatusWithNotSet)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-6 border-t mt-auto">
          <Button
            variant="outline"
            className="flex-1 rounded-lg"
            onClick={() => {
              onFiltersChange({ status: [] });
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
