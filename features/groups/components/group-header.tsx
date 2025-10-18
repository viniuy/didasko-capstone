import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GroupHeaderProps {
  courseCode: string;
  courseSection: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function GroupHeader({
  courseCode,
  courseSection,
  searchQuery,
  onSearchChange,
}: GroupHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b bg-[#F5F6FA] rounded-t-lg">
      <Button
        variant="ghost"
        className="h-9 w-9 p-0 hover:bg-gray-100"
        onClick={() => window.history.back()}
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
        <div className="relative w-64">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            placeholder="Search a group"
            className="w-full pl-9 rounded-full border-gray-200 h-9 bg-[#F5F6FA]"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
