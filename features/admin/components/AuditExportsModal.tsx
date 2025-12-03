"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, AlertCircle, Loader2 } from "lucide-react";

interface Export {
  name: string;
  created_at: string;
  size: number;
  downloadUrl: string | null;
}

interface AuditExportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditExportsModal({
  open,
  onOpenChange,
}: AuditExportsModalProps) {
  const [exports, setExports] = useState<Export[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchExports();
    }
  }, [open]);

  const fetchExports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/export-logs-list");
      if (!response.ok) {
        throw new Error("Failed to fetch exports");
      }
      const data = await response.json();
      setExports(data.exports || []);
    } catch (err) {
      console.error("Error fetching exports:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch exports");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (exportFile: Export) => {
    if (!exportFile.downloadUrl) {
      setError("Download URL not available for this export");
      return;
    }

    setDownloadingId(exportFile.name);
    try {
      const response = await fetch(exportFile.downloadUrl);
      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFile.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading export:", err);
      setError("Failed to download export");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#124A69]">
            Exported Audit Logs
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Download automatically exported audit logs from the Supabase bucket.
            Files are exported weekly and available for download.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#124A69] animate-spin mb-3" />
            <p className="text-gray-600">Loading exports...</p>
          </div>
        ) : exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
            <Download className="w-10 h-10 text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">
              No exports available yet
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Weekly exports will appear here once the cron job runs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader className="bg-[#124A69]">
                <TableRow>
                  <TableHead className="text-white">File Name</TableHead>
                  <TableHead className="text-white">Created At</TableHead>
                  <TableHead className="text-white text-right">Size</TableHead>
                  <TableHead className="text-white text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((exportFile) => (
                  <TableRow
                    key={exportFile.name}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <TableCell className="font-mono text-sm break-words">
                      {exportFile.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(exportFile.created_at), "MMM dd, yyyy")}
                      <br />
                      <span className="text-xs text-gray-500">
                        {format(new Date(exportFile.created_at), "HH:mm:ss")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">
                        {formatFileSize(exportFile.size)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {exportFile.downloadUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(exportFile)}
                          disabled={downloadingId === exportFile.name}
                          className="border-[#124A69] text-[#124A69] hover:bg-blue-50"
                        >
                          {downloadingId === exportFile.name ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1" />
                          )}
                          {downloadingId === exportFile.name
                            ? "Downloading..."
                            : "Download"}
                        </Button>
                      ) : (
                        <Badge variant="secondary">Unavailable</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-300"
          >
            Close
          </Button>
          {!isLoading && exports.length > 0 && (
            <Button
              variant="outline"
              onClick={fetchExports}
              className="border-[#124A69] text-[#124A69] hover:bg-blue-50"
            >
              Refresh
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
