"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lightbulb, ArrowRight, ArrowLeft } from "lucide-react";

export interface TutorialStep {
  target: string;
  title?: string;
  content: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  spotlightPadding?: number;
}

interface CustomTutorialProps {
  steps: TutorialStep[];
  run: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  continuous?: boolean;
  showProgress?: boolean;
  showSkipButton?: boolean;
  spotlightPadding?: number;
  locale?: {
    back?: string;
    close?: string;
    last?: string;
    next?: string;
    skip?: string;
  };
}

const defaultLocale = {
  back: "Previous",
  close: "Close",
  last: "Got it!",
  next: "Next",
  skip: "Skip Tour",
};

export default function CustomTutorial({
  steps,
  run,
  onComplete,
  onSkip,
  continuous = true,
  showProgress = true,
  showSkipButton = true,
  spotlightPadding = 8,
  locale = defaultLocale,
}: CustomTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightBox, setHighlightBox] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const stepTargetRef = useRef<string>("");
  const lastRectRef = useRef<DOMRect | null>(null);
  const updatePositionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (run) {
      setCurrentStep(0);
    }
  }, [run]);

  useEffect(() => {
    if (!run || currentStep >= steps.length || currentStep < 0) {
      setHighlightBox(null);
      return;
    }

    const step = steps[currentStep];
    if (!step) return;

    const updatePosition = () => {
      const element = document.querySelector(step.target);
      if (!element) {
        setHighlightBox(null);
        return;
      }

      const rect = element.getBoundingClientRect();

      // Only update if rect actually changed significantly
      if (lastRectRef.current) {
        const threshold = 1;
        if (
          Math.abs(lastRectRef.current.top - rect.top) < threshold &&
          Math.abs(lastRectRef.current.left - rect.left) < threshold &&
          Math.abs(lastRectRef.current.width - rect.width) < threshold &&
          Math.abs(lastRectRef.current.height - rect.height) < threshold
        ) {
          return;
        }
      }

      lastRectRef.current = rect;
      setHighlightBox(rect);

      const padding = step.spotlightPadding || spotlightPadding;
      const placement = step.placement || "bottom";
      let top = 0;
      let left = 0;

      switch (placement) {
        case "bottom":
          top = rect.bottom + padding + 10;
          left = rect.left + rect.width / 2;
          break;
        case "top":
          // Position tooltip so it sits right on top of the highlighted element
          // We'll use translateY(-100%) to position it above, so set top to element's top
          top = rect.top - padding;
          left = rect.left + rect.width / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2;
          left = rect.left - padding - 10;
          break;
        case "right":
          top = rect.top + rect.height / 2;
          left = rect.right + padding + 10;
          break;
      }

      setTooltipPosition({ top, left });
    };

    // Only update if target changed
    if (stepTargetRef.current !== step.target) {
      stepTargetRef.current = step.target;
      lastRectRef.current = null;
    }

    updatePosition();
    updatePositionRef.current = updatePosition;

    const timer = setTimeout(updatePosition, 100);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      updatePositionRef.current = null;
    };
  }, [run, currentStep, steps, spotlightPadding]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (onComplete) onComplete();
      setCurrentStep(0);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (onSkip) onSkip();
    setCurrentStep(0);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Prevent clicks outside the highlighted area
    e.preventDefault();
    e.stopPropagation();
  };

  if (!run || steps.length === 0 || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  if (!step || !highlightBox) return null;

  const padding = step.spotlightPadding || spotlightPadding;
  const placement = step.placement || "bottom";

  // Get the highlighted element to make it clickable
  const highlightedElement = document.querySelector(step.target);

  return (
    <>
      {/* Dark Overlay - Blocks clicks outside highlighted area */}
      <div
        className="fixed inset-0 z-[100] pointer-events-auto"
        style={{
          clipPath: `polygon(
            0% 0%,
            0% 100%,
            ${highlightBox.left - padding}px 100%,
            ${highlightBox.left - padding}px ${highlightBox.top - padding}px,
            ${highlightBox.left + highlightBox.width + padding}px ${
            highlightBox.top - padding
          }px,
            ${highlightBox.left + highlightBox.width + padding}px ${
            highlightBox.top + highlightBox.height + padding
          }px,
            ${highlightBox.left - padding}px ${
            highlightBox.top + highlightBox.height + padding
          }px,
            ${highlightBox.left - padding}px 100%,
            100% 100%,
            100% 0%
          )`,
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <svg className="w-full h-full pointer-events-none">
          <defs>
            <mask id={`tutorial-mask-${currentStep}`}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={highlightBox.left - padding}
                y={highlightBox.top - padding}
                width={highlightBox.width + padding * 2}
                height={highlightBox.height + padding * 2}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask={`url(#tutorial-mask-${currentStep})`}
          />
        </svg>
      </div>

      {/* Highlight Border */}
      <div
        className="fixed z-[101] border-4 border-[#124A69] rounded-lg pointer-events-none animate-pulse"
        style={{
          top: highlightBox.top - padding,
          left: highlightBox.left - padding,
          width: highlightBox.width + padding * 2,
          height: highlightBox.height + padding * 2,
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[102] pointer-events-auto"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform:
            placement === "bottom"
              ? "translateX(-50%)"
              : placement === "top"
              ? "translate(-50%, -100%)"
              : placement === "right"
              ? "translateX(0)"
              : "translateX(-100%)",
        }}
      >
        <div className="bg-white rounded-lg shadow-2xl border-2 border-[#124A69] max-w-sm">
          <div className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-[#124A69]/10 rounded-lg flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-[#124A69]" />
              </div>
              <div className="flex-1">
                {step.title && (
                  <h3 className="font-bold text-gray-900 mb-1 text-base">
                    {step.title}
                  </h3>
                )}
                <div className="text-sm text-gray-600 leading-relaxed">
                  {step.content}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              {showProgress && (
                <span className="text-xs text-gray-500 font-medium">
                  {currentStep + 1} of {steps.length}
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {showSkipButton && (
                  <button
                    onClick={handleSkip}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    {locale.skip}
                  </button>
                )}
                {currentStep > 0 && (
                  <button
                    onClick={handlePrevious}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors bg-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {locale.back}
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-1.5 bg-[#124A69] text-white rounded-lg text-sm hover:bg-[#0D3A54] transition-colors"
                >
                  {currentStep === steps.length - 1 ? locale.last : locale.next}
                  {currentStep < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
