import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatISO } from "date-fns";

// Vercel Cron Secret (set in Vercel dashboard environment variables)
const CRON_SECRET = process.env.CRON_SECRET || "";

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : JSON.stringify(value);
  if (s.includes('"')) s = s.replace(/"/g, '""');
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret (Vercel includes this header in cron requests)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const DAYS = parseInt(process.env.AUDIT_EXPORT_RETENTION_DAYS || "7", 10);
    const BUCKET = process.env.AUDIT_EXPORT_BUCKET || "audit-logs";
    const DELETE_AFTER_UPLOAD =
      (process.env.AUDIT_EXPORT_DELETE_AFTER_UPLOAD || "true") === "true";

    const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
    console.log(
      `[Audit Export Cron] Exporting logs created on or before ${cutoff.toISOString()}`
    );

    // Fetch logs older than retention period
    const logs = await prisma.auditLog.findMany({
      where: { createdAt: { lte: cutoff } },
      orderBy: { createdAt: "asc" },
    });

    if (!logs || logs.length === 0) {
      console.log("[Audit Export Cron] No audit logs to export.");
      return NextResponse.json(
        { message: "No audit logs to export.", exported: 0, deleted: 0 },
        { status: 200 }
      );
    }

    // Build CSV
    const headers = [
      "id",
      "createdAt",
      "userId",
      "action",
      "module",
      "before",
      "after",
      "reason",
      "batchId",
      "errorMessage",
      "metadata",
      "status",
    ];

    const rows: string[] = [headers.join(",")];

    for (const r of logs) {
      const row = [
        escapeCsv(r.id),
        escapeCsv(r.createdAt ? r.createdAt.toISOString() : ""),
        escapeCsv(r.userId || ""),
        escapeCsv(r.action || ""),
        escapeCsv(r.module || ""),
        escapeCsv(r.before || ""),
        escapeCsv(r.after || ""),
        escapeCsv(r.reason || ""),
        escapeCsv(r.batchId || ""),
        escapeCsv(r.errorMessage || ""),
        escapeCsv(r.metadata || ""),
        escapeCsv(r.status || ""),
      ];
      rows.push(row.join(","));
    }

    const csv = rows.join("\n");

    // Generate timestamped filename
    const timestamp = formatISO(new Date()).replace(/[:.]/g, "-");
    const filename = `audit-logs-export-${timestamp}.csv`;
    const filePath = `exports/${filename}`;

    console.log(
      `[Audit Export Cron] Uploading ${logs.length} rows to bucket '${BUCKET}' as ${filePath}...`
    );

    // Upload to Supabase
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, Buffer.from(csv, "utf-8"), {
        contentType: "text/csv",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Audit Export Cron] Upload failed:", uploadError);
      return NextResponse.json(
        { error: "Upload failed", details: uploadError.message },
        { status: 500 }
      );
    }

    console.log("[Audit Export Cron] Upload succeeded.");

    let deletedCount = 0;
    if (DELETE_AFTER_UPLOAD) {
      const ids = logs.map((l) => l.id);
      const deleteResult = await prisma.auditLog.deleteMany({
        where: { id: { in: ids } },
      });
      deletedCount = deleteResult.count;
      console.log(
        `[Audit Export Cron] Deleted ${deletedCount} exported audit log rows.`
      );
    } else {
      console.log("[Audit Export Cron] Configured to keep rows after export.");
    }

    return NextResponse.json(
      {
        message: "Audit logs exported successfully",
        exported: logs.length,
        deleted: deletedCount,
        filename,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Audit Export Cron] Error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error.message },
      { status: 500 }
    );
  }
}
