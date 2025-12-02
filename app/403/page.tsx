import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-6xl font-bold text-[#124A69]">403</h1>
      <h2 className="text-2xl font-semibold text-gray-700">Forbidden</h2>
      <p className="text-gray-600 text-center max-w-md">
        You don't have permission to access this page.
      </p>
      <Link href="/dashboard">
        <Button className="bg-[#124A69] text-white hover:bg-[#0d3a56]">
          Go to Dashboard
        </Button>
      </Link>
    </div>
  );
}
