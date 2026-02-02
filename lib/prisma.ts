import { PrismaClient } from '@prisma/client';
import { auditExtension } from './prisma-middleware';

declare global {
  var prisma: PrismaClient | undefined;
}

// Configure connection pool to prevent "Max client connections reached"
// Prisma uses connection pooling by default
// The connection pool size is controlled via DATABASE_URL query parameters:
// ?connection_limit=10&pool_timeout=20
const basePrisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
});

// Apply audit extension (Prisma 6+)
const prisma = global.prisma || basePrisma.$extends(auditExtension);

// Always use global singleton to prevent multiple instances
// This is critical for connection pool management
if (!global.prisma) {
  global.prisma = prisma;
}

// Ensure connections are properly managed
// Disconnect on process termination
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });

  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

export { prisma };
