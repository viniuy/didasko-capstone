"use client";
import { useSession } from "next-auth/react";

export default function Greet() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "User";
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-6 -mt-4 gap-2 sm:gap-0">
      <h1 className="text-base sm:text-lg md:text-xl font-bold text-muted-foreground">
        Welcome back, {firstName}!
      </h1>
      <p className="text-sm sm:text-base md:text-xl font-bold text-muted-foreground">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
    </header>
  );
}
