#!/usr/bin/env node
/*
  Export audit logs older than a retention period to Supabase storage
  and optionally delete exported rows.

  Usage:
    AUDIT_EXPORT_RETENTION_DAYS=7 AUDIT_EXPORT_BUCKET=audit-logs AUDIT_EXPORT_DELETE_AFTER_UPLOAD=true node ./scripts/export-audit-logs.js

  Recommended: run weekly via cron on your server or a scheduled job runner.
*/

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const { formatISO } = require("date-fns");

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DAYS = parseInt(process.env.AUDIT_EXPORT_RETENTION_DAYS || "7", 10);
const BUCKET = process.env.AUDIT_EXPORT_BUCKET || "audit-logs";
const DELETE_AFTER_UPLOAD =
  (process.env.AUDIT_EXPORT_DELETE_AFTER_UPLOAD || "true") === "true";

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : JSON.stringify(value);
  if (s.includes('"')) s = s.replace(/"/g, '""');
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s}"`;
  }
  return s;
}

async function run() {
  try {
    const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
    console.log(
      `Exporting audit logs created on or before ${cutoff.toISOString()}`
    );

    const logs = await prisma.auditLog.findMany({
      where: { createdAt: { lte: cutoff } },
      orderBy: { createdAt: "asc" },
    });

    if (!logs || logs.length === 0) {
      console.log("No audit logs to export.");
      await prisma.$disconnect();
      process.exit(0);
    }

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

    const rows = [headers.join(",")];

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
    const timestamp = formatISO(new Date()).replace(/[:]/g, "-");
    const filename = `audit-logs-export-${timestamp}.csv`;
    const filePath = `exports/${filename}`;

    console.log(
      `Uploading ${logs.length} rows to bucket '${BUCKET}' as ${filePath}...`
    );

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, Buffer.from(csv, "utf-8"), {
        contentType: "text/csv",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload failed:", uploadError.message || uploadError);
      await prisma.$disconnect();
      process.exit(2);
    }

    console.log("Upload succeeded.");

    if (DELETE_AFTER_UPLOAD) {
      const ids = logs.map((l) => l.id);
      const deleteResult = await prisma.auditLog.deleteMany({
        where: { id: { in: ids } },
      });
      console.log(`Deleted ${deleteResult.count} exported audit log rows.`);
    } else {
      console.log(
        "Configured to keep rows after export (AUDIT_EXPORT_DELETE_AFTER_UPLOAD=false)."
      );
    }

    await prisma.$disconnect();
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Error exporting audit logs:", err);
    try {
      await prisma.$disconnect();
    } catch (e) {}
    process.exit(3);
  }
}

run();
