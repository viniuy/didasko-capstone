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
    const FIRST_RUN =
      (process.env.AUDIT_EXPORT_FIRST_RUN || "false") === "true";

    // First run: export ALL logs. Subsequent runs: export logs from past N days.
    const testMode = request.nextUrl.searchParams.get("testMode") === "true";
    let cutoff: Date;

    if (testMode) {
      cutoff = new Date(Date.now() - (1 / 24) * 24 * 60 * 60 * 1000); // 1 hour for testing
    } else if (FIRST_RUN) {
      // Export all logs: set cutoff to year 2000 (will match all logs)
      cutoff = new Date("2000-01-01T00:00:00Z");
      console.log("[Audit Export Cron] FIRST_RUN mode: exporting ALL logs");
    } else {
      // Normal run: export logs from past N days
      cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
    }

    console.log(
      `[Audit Export Cron] Exporting logs created on or before ${cutoff.toISOString()} (testMode: ${testMode}, firstRun: ${FIRST_RUN})`
    );

    // Count total logs for debugging
    // Count total logs for debugging
    const totalLogs = await prisma.auditLog.count();
    console.log(
      `[Audit Export Cron] Total audit logs in database: ${totalLogs}`
    );

    // Fetch logs: if FIRST_RUN export ALL logs, otherwise export logs older than cutoff
    let logs;
    if (FIRST_RUN) {
      console.log(
        "[Audit Export Cron] FIRST_RUN enabled — fetching ALL audit logs."
      );
      logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
      console.log(
        `[Audit Export Cron] Found ${logs.length} logs to export (FIRST_RUN: all logs)`
      );
    } else {
      logs = await prisma.auditLog.findMany({
        where: { createdAt: { lte: cutoff } },
        orderBy: { createdAt: "asc" },
      });
      console.log(
        `[Audit Export Cron] Found ${
          logs.length
        } logs to export (cutoff: ${cutoff.toISOString()})`
      );
    }

    if (!logs || logs.length === 0) {
      console.log("[Audit Export Cron] No audit logs to export.");
      return NextResponse.json(
        {
          message: "No audit logs to export.",
          exported: 0,
          deleted: 0,
          totalLogsInDb: totalLogs,
          cutoffDate: cutoff.toISOString(),
          retentionDays: FIRST_RUN ? "ALL (first run)" : DAYS,
          testMode,
          firstRun: FIRST_RUN,
        },
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
