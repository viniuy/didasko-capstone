import { NextResponse } from "next/server";
import { getFacultyCount } from "@/lib/services";

export async function GET() {
  try {
    const result = await getFacultyCount();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching faculty count:", error);
    return NextResponse.json(
      { error: "Failed to fetch faculty count" },
      { status: 500 }
    );
  }
}
