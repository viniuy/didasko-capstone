"use client";

import Link from "next/link";
import SplitText from "@/components/ui/SplitText";
import AnimatedContent from "@/components/ui/AnimatedContent";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function CourseEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] my-8 rounded-md border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden">
      <div className="text-center px-4 pb-8 z-10 relative">
        <div className="mb-8">
          <SplitText
            text="Welcome to your Dashboard"
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#124A69]"
            delay={0.2}
            duration={0.6}
            stagger={0.03}
          />
        </div>
        <AnimatedContent
          container={null}
          delay={1.5}
          duration={0.8}
          direction="vertical"
          distance={30}
          initialOpacity={0}
          className="mt-6"
          onComplete={() => {}}
          onDisappearanceComplete={() => {}}
        >
          <p className="text-lg sm:text-xl text-gray-600 mb-4">
            Get started by adding your first course!
          </p>
          <p className="text-sm sm:text-base text-gray-500 mb-8">
            Create and manage your courses, track attendance, and grade your
            students all in one place.
          </p>
        </AnimatedContent>
        <div className="flex items-center justify-center mt-8">
          <Link href="/main/course">
            <Button className="bg-[#124A69] hover:bg-[#0D3A54] text-white gap-2 px-6 py-3 text-base">
              Go to Course Management
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
