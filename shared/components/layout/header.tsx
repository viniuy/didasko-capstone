"use client";

import Image from "next/image";

export default function Header() {
  return (
    <div className="w-[102.6%] -ml-5 bg-white border-b border-gray-400 flex justify-between shadow-lg items-center">
      <Image
        src="/didasko-logo.png"
        alt="Logo"
        width={240}
        height={76}
        className="w-60 h-19"
      />
    </div>
  );
}
