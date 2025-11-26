"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import FuzzyText from "@/components/FuzzyText";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#124A69] via-[#0D3A54] to-[#0a2f42] p-4">
      <div className="text-center space-y-8 max-w-2xl">
        {/* FuzzyText for 404 */}
        <div className="flex justify-center">
          <FuzzyText
            fontSize="clamp(4rem, 15vw, 12rem)"
            fontWeight={900}
            color="#fff"
            enableHover={true}
            baseIntensity={0.2}
            hoverIntensity={0.6}
          >
            404
          </FuzzyText>
        </div>

        {/* Error Message */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Page Not Found
          </h1>
          <p className="text-lg md:text-xl text-white/80">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Button
            asChild
            className="bg-white text-[#124A69] hover:bg-white/90 font-semibold px-6 py-3 text-base"
          >
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Go Home
            </Link>
          </Button>
          <Button
            asChild
            className="bg-white text-[#124A69] hover:bg-white/90 font-semibold px-6 py-3 text-base"
            onClick={() => window.history.back()}
          >
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.history.back();
              }}
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
