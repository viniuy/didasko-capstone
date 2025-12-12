import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  requireAcademicHead,
  handleAuthError,
} from "@/lib/authz";
import { withLogging } from "@/lib/withLogging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withLogging(
  { action: "FACULTY_REQUEST_LIST", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const userRoles = session.user.roles || [];

      if (userRoles.includes("ACADEMIC_HEAD") || userRoles.includes("ADMIN")) {
        // Return all requests (Academic Head and Admin can view)
        const requests = await prisma.facultyAssignmentRequest.findMany({
          orderBy: { requestedAt: "desc" },
          include: {
            admin: {
              select: { id: true, name: true, email: true, roles: true },
            },
          },
        });

        // Debug: log who requested the list and how many items we're returning
        try {
          console.log("[FACULTY_REQUEST_LIST] requester:", session.user.id, {
            roles: session.user.roles,
            returned: Array.isArray(requests) ? requests.length : 0,
          });
        } catch (logErr) {
          console.warn(
            "[FACULTY_REQUEST_LIST] failed to log debug info",
            logErr
          );
        }

        return NextResponse.json({ requests });
      }

      // Others see only their requests
      const requests = await prisma.facultyAssignmentRequest.findMany({
        where: { adminId: session.user.id },
        orderBy: { requestedAt: "desc" },
      });

      return NextResponse.json({ requests });
    } catch (error) {
      return handleAuthError(error);
    }
  }
);

export const POST = withLogging(
  { action: "FACULTY_REQUEST_CREATE", module: "Security" },
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Read and log incoming request body once for debugging (temporary)
      let rawBody = "";
      try {
        rawBody = await req.text();
        console.log("[FACULTY_REQUEST_CREATE] incoming by:", session.user.id, {
          url: req.url,
          method: req.method,
          rawBody,
        });
      } catch (logErr) {
        console.warn(
          "[FACULTY_REQUEST_CREATE] failed to read raw body",
          logErr
        );
      }

      // Only Admins can request self-assignment
      requireAdmin(session.user);

      // Don't allow requesting if user already has FACULTY role (check DB, not just session)
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
      });
      if (
        dbUser &&
        Array.isArray(dbUser.roles) &&
        dbUser.roles.includes("FACULTY")
      ) {
        return NextResponse.json(
          { error: "User already has FACULTY role" },
          { status: 400 }
        );
      }

      // Prevent duplicate pending requests
      const existingPending = await prisma.facultyAssignmentRequest.findFirst({
        where: { adminId: session.user.id, status: "PENDING" },
      });

      if (existingPending) {
        return NextResponse.json(
          { error: "A pending request already exists" },
          { status: 409 }
        );
      }

      // Parse JSON from the raw body we already read
      let body: any = {};
      try {
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch (parseErr) {
        return NextResponse.json(
          { error: "invalid JSON body" },
          { status: 400 }
        );
      }
      const { expiresAt, note } = body;

      if (!expiresAt) {
        return NextResponse.json(
          { error: "expiresAt required" },
          { status: 400 }
        );
      }

      const expires = new Date(expiresAt);
      if (isNaN(expires.getTime())) {
        return NextResponse.json(
          { error: "invalid expiresAt" },
          { status: 400 }
        );
      }

      const request = await prisma.facultyAssignmentRequest.create({
        data: {
          adminId: session.user.id,
          expiresAt: expires,
          note: note || null,
        },
      });

      console.log("[FACULTY_REQUEST_CREATE] created", {
        id: request.id,
        adminId: request.adminId,
      });

      return NextResponse.json({ request }, { status: 201 });
    } catch (error) {
      return handleAuthError(error);
    }
  }
);
