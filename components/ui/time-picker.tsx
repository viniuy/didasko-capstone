"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const minutes = ["00", "15", "30", "45"];

// Hours for school time: 7am-8pm
// AM: 7, 8, 9, 10, 11
// PM: 12, 1, 2, 3, 4, 5, 6, 7, 8
const amHours = [7, 8, 9, 10, 11];
const pmHours = [12, 1, 2, 3, 4, 5, 6, 7, 8];

export function TimePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const parseTime = () => {
    if (!value) return { hour: "", minute: "", period: "AM" };
    const [time, period] = value.split(" ");
    const [h, m] = time.split(":");
    return { hour: h, minute: m || "00", period: period || "AM" };
  };

  const { hour, minute, period } = parseTime();

  const handleSelect = (h: string, m: string, p: string) => {
    const formattedHour = h.padStart(2, "0");
    onChange(`${formattedHour}:${m} ${p}`);
    // Auto-close after selection for better UX
  };

  // Get available hours based on period
  const availableHours = period === "AM" ? amHours : pmHours;
  const currentHourNum = hour ? parseInt(hour) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between text-sm h-9 hover:bg-blue-50 hover:border-[#124A69] transition-colors"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#124A69]" />
            <span
              className={value ? "text-gray-900 font-medium" : "text-gray-400"}
            >
              {value || "Select time"}
            </span>
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          {/* Period Selector (AM/PM) - Moved to top for better UX */}
          <div className="flex gap-2 pb-2 border-b">
            {["AM", "PM"].map((p) => {
              const defaultHour = p === "AM" ? "07" : "01";
              const isValidHour =
                p === "AM"
                  ? currentHourNum && amHours.includes(currentHourNum)
                  : currentHourNum && pmHours.includes(currentHourNum);

              return (
                <Button
                  key={p}
                  variant={p === period ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 font-semibold ${
                    p === period
                      ? "bg-[#124A69] text-white hover:bg-[#0D3A54]"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    const hourToUse = isValidHour ? hour : defaultHour;
                    handleSelect(hourToUse || defaultHour, minute || "00", p);
                  }}
                >
                  {p}
                </Button>
              );
            })}
          </div>

          {/* Time Selector Grid */}
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            {/* Hours */}
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-600 mb-1 px-1">
                Hour
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                {availableHours.map((h) => {
                  const hourStr = h.toString().padStart(2, "0");
                  const isSelected =
                    hourStr === hour || (hour && parseInt(hour) === h);
                  return (
                    <Button
                      key={h}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`h-8 text-sm font-medium ${
                        isSelected
                          ? "bg-[#124A69] text-white hover:bg-[#0D3A54]"
                          : "hover:bg-blue-50 hover:border-[#124A69]"
                      }`}
                      onClick={() =>
                        handleSelect(hourStr, minute || "00", period || "AM")
                      }
                    >
                      {h}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Minutes */}
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-600 mb-1 px-1">
                Minute
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                {minutes.map((m) => (
                  <Button
                    key={m}
                    variant={m === minute ? "default" : "outline"}
                    size="sm"
                    className={`h-8 text-sm font-medium ${
                      m === minute
                        ? "bg-[#124A69] text-white hover:bg-[#0D3A54]"
                        : "hover:bg-blue-50 hover:border-[#124A69]"
                    }`}
                    onClick={() =>
                      handleSelect(hour || "07", m, period || "AM")
                    }
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Display Selected Time */}
          {value && (
            <div className="pt-2 border-t text-center">
              <div className="text-xs text-gray-500 mb-1">Selected Time</div>
              <div className="text-lg font-bold text-[#124A69]">{value}</div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
