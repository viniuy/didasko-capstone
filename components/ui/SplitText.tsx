"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  onComplete?: () => void;
}

export default function SplitText({
  text,
  className = "",
  delay = 0,
  duration = 0.8,
  stagger = 0.02,
  onComplete,
}: SplitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || hasAnimatedRef.current) return;

    const chars = text.split("");
    const spans = chars.map((char, index) => {
      const span = document.createElement("span");
      span.textContent = char === " " ? "\u00A0" : char;
      span.style.display = "inline-block";
      span.style.opacity = "0";
      span.style.transform = "translateY(20px)";
      return span;
    });

    containerRef.current.innerHTML = "";
    spans.forEach((span) => containerRef.current?.appendChild(span));

    const tl = gsap.timeline({
      delay,
      onComplete: () => {
        hasAnimatedRef.current = true;
        onComplete?.();
      },
    });

    tl.to(spans, {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      ease: "power3.out",
    });
  }, [text, delay, duration, stagger, onComplete]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ display: "inline-block" }}
    />
  );
}
