import { NextRequest } from "next/server";

/**
 * Extracts the client IP address from a request.
 * Checks headers in order: x-forwarded-for, x-real-ip, cf-connecting-ip
 *
 * @param req - NextRequest or Request object
 * @returns IP address string or 'unknown' if not found
 */
export function getClientIp(req: NextRequest | Request): string {
  // Handle NextRequest
  if (req instanceof NextRequest) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const firstIp = forwardedFor.split(",")[0].trim();
      if (firstIp) return firstIp;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
  } else {
    // Handle standard Request
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const firstIp = forwardedFor.split(",")[0].trim();
      if (firstIp) return firstIp;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
  }

  return "unknown";
}
