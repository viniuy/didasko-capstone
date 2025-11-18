import { PrismaClient } from "@prisma/client";
import { setupAuditMiddleware } from "./prisma-middleware";

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Apply audit middleware
if (!global.prisma) {
  setupAuditMiddleware(prisma);
}

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export { prisma };
