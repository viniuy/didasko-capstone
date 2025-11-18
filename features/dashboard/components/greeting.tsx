"use client";
import { useSession } from "next-auth/react";

export default function Greet() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "User";
  return (
    <header className="flex justify-between items-center pt-6 -mt-4 ">
      <h1 className="text-xl font-bold text-muted-foreground">
        Welcome back, {firstName}!
      </h1>
      <p className="text-xl font-bold text-muted-foreground">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
    </header>
  );
}
