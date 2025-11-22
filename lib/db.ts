// Re-export from the main prisma client to avoid duplicate instances
// This prevents connection pool exhaustion
export { prisma } from "./prisma";
