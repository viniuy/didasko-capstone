"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface ReportingTypeButtonsProps {
  courseSlug: string;
}

export function ReportingTypeButtons({
  courseSlug,
}: ReportingTypeButtonsProps) {
  const [isIndividualRedirecting, setIsIndividualRedirecting] = useState(false);
  const [isGroupRedirecting, setIsGroupRedirecting] = useState(false);

  return (
    <>
      <Button
        className={`
          w-full cursor-pointer transition-colors
          ${
            isIndividualRedirecting
              ? "bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-400"
              : "bg-[#124A69] hover:bg-gray-800 text-white"
          }
        `}
        disabled={isIndividualRedirecting}
        asChild
      >
        <Link
          href={`/main/grading/reporting/${courseSlug}/individual`}
          onClick={() => setIsIndividualRedirecting(true)}
        >
          {isIndividualRedirecting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting...
            </span>
          ) : (
            "Select Student"
          )}
        </Link>
      </Button>

      <Button
        className={`
          w-full cursor-pointer transition-colors
          ${
            isGroupRedirecting
              ? "bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-400"
              : "bg-[#124A69] hover:bg-gray-800 text-white"
          }
        `}
        disabled={isGroupRedirecting}
        asChild
      >
        <Link
          href={`/main/grading/reporting/${courseSlug}/group/`}
          onClick={() => setIsGroupRedirecting(true)}
        >
          {isGroupRedirecting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting...
            </span>
          ) : (
            "Select Group"
          )}
        </Link>
      </Button>
    </>
  );
}
