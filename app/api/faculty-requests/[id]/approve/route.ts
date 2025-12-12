import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { requireAcademicHead, handleAuthError } from "@/lib/authz";
import { withLogging } from "@/lib/withLogging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withLogging(
  { action: "FACULTY_REQUEST_APPROVE", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      requireAcademicHead(session.user);

      const url = new URL(req.url);
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 2];

      const existing = await prisma.facultyAssignmentRequest.findUnique({
        where: { id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (existing.status !== "PENDING") {
        return NextResponse.json(
          { error: "Request already decided" },
          { status: 400 }
        );
      }

      const updated = await prisma.facultyAssignmentRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: session.user.id,
          decisionAt: new Date(),
        },
      });

      return NextResponse.json({ request: updated });
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
