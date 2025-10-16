import { PrismaClient } from "@prisma/client/edge";

// Create the base Prisma client
const prismaClient = globalThis.prisma || new PrismaClient();

// Log available models to debug
console.log("Available Prisma models:", Object.keys(prismaClient));

if (process.env.NODE_ENV !== "production") globalThis.prisma = prismaClient;

// Export the client as prisma
export const prisma = prismaClient;
