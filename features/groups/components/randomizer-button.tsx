import React from "react";

interface RandomizerButtonProps {
  disabled?: boolean;
  onClick?: () => void;
}

export function RandomizerButton({
  disabled = false,
  onClick,
}: RandomizerButtonProps) {
  return (
    <button
      className="relative h-35 w-35 rounded-full bg-gray-200 flex flex-col items-center justify-center shadow-none transition-all p-0 mb-2 border-none outline-none focus:outline-none cursor-pointer group"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="absolute inset-0 flex items-center justify-center">
        <svg
          className="h-20 w-20 text-gray-400 opacity-70"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
        <svg
          className="h-10 w-10 text-white absolute"
          style={{
            filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.15))",
          }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="M12 5v14m7-7H5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="mt-20 text-sm font-bold text-white drop-shadow-sm text-shadow-lg text-center pointer-events-none select-none">
        Add groups using a
        <br />
        randomizer
      </span>
    </button>
  );
}
