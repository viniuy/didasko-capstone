import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Check if user is authenticated and is admin
    if (!session || !session.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { roles: true },
    });

    if (!user || !user.roles.includes(Role.ADMIN)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Missing Supabase configuration", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List files in the audit-logs bucket
    const bucket = process.env.AUDIT_EXPORT_BUCKET || "audit-logs";
    const { data, error } = await supabase.storage
      .from(bucket)
      .list("exports", {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("Error listing exports from Supabase:", error);
      return new Response("Failed to list exports", { status: 500 });
    }

    // Generate signed URLs for download (valid for 1 hour)
    const exportsWithUrls = await Promise.all(
      (data || [])
        .filter((file) => file.name.endsWith(".txt"))
        .map(async (file) => {
          try {
            const { data: urlData } = await supabase.storage
              .from(bucket)
              .createSignedUrl(`exports/${file.name}`, 3600); // 1 hour expiry

            return {
              name: file.name,
              created_at: file.created_at,
              size: file.metadata?.size || 0,
              downloadUrl: urlData?.signedUrl || null,
            };
          } catch (err) {
            console.error(`Error generating signed URL for ${file.name}:`, err);
            return {
              name: file.name,
              created_at: file.created_at,
              size: file.metadata?.size || 0,
              downloadUrl: null,
            };
          }
        })
    );

    return new Response(
      JSON.stringify({
        success: true,
        exports: exportsWithUrls,
        count: exportsWithUrls.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in export-logs-list route:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
