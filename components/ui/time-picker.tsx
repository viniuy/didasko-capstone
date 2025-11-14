"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const hours = Array.from({ length: 12 }).map((_, i) => i + 1);
const minutes = ["00", "15", "30", "45"];

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
          {hours.map((h) => (
            <Button
              key={h}
              variant={h.toString() === hour ? "default" : "outline"}
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() =>
                handleSelect(
                  h.toString().padStart(2, "0"),
                  minute || "00",
                  period
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
          {["AM", "PM"].map((p) => (
            <Button
              key={p}
              variant={p === period ? "default" : "outline"}
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => handleSelect(hour || "01", minute || "00", p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
