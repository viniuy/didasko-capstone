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
// AM: 7, 8, 9, 10, 11, 12
// PM: 1, 2, 3, 4, 5, 6, 7, 8
const amHours = [7, 8, 9, 10, 11, 12];
const pmHours = [1, 2, 3, 4, 5, 6, 7, 8];

export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const parseTime = () => {
    if (!value) return { hour: "", minute: "", period: "AM" };
    const [time, period] = value.split(" ");
    const [h, m] = time.split(":");
    return { hour: h, minute: m, period };
  };

  const { hour, minute, period } = parseTime();

  const handleSelect = (h: string, m: string, p: string) => {
    onChange(`${h}:${m} ${p}`);
  };

  // Get available hours based on period
  const availableHours = period === "AM" ? amHours : pmHours;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between text-xs h-9"
        >
          <Clock className="mr-1 h-3 w-3" />
          {value || "Time"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-36 p-2 grid grid-cols-[1fr_1fr_0.7fr] gap-1">
        {/* Hours */}
        <div className="space-y-1 max-h-28 overflow-y-auto">
          {availableHours.map((h) => (
            <Button
              key={h}
              variant={h.toString() === hour ? "default" : "outline"}
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() =>
                handleSelect(
                  h.toString().padStart(2, "0"),
                  minute || "00",
                  period || "AM"
                )
              }
            >
              {h}
            </Button>
          ))}
        </div>

        {/* Minutes */}
        <div className="space-y-1 max-h-28 overflow-y-auto">
          {minutes.map((m) => (
            <Button
              key={m}
              variant={m === minute ? "default" : "outline"}
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => handleSelect(hour || "01", m, period)}
            >
              {m}
            </Button>
          ))}
        </div>

        {/* AM/PM */}
        <div className="space-y-1">
          {["AM", "PM"].map((p) => {
            // When switching period, reset to first valid hour for that period
            const defaultHour = p === "AM" ? "07" : "01";
            const currentHourNum = hour ? parseInt(hour) : null;
            const isValidHour =
              p === "AM"
                ? currentHourNum && amHours.includes(currentHourNum)
                : currentHourNum && pmHours.includes(currentHourNum);

            return (
              <Button
                key={p}
                variant={p === period ? "default" : "outline"}
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => {
                  // If current hour is valid for new period, keep it; otherwise use default
                  const hourToUse = isValidHour ? hour : defaultHour;
                  handleSelect(hourToUse, minute || "00", p);
                }}
              >
                {p}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
