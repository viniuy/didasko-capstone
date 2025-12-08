import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function changeRfidToBigInt() {
  try {
    console.log("Altering rfid_id column to BIGINT...");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE students ALTER COLUMN rfid_id TYPE BIGINT;
    `);

    console.log("✅ Successfully changed rfid_id to BIGINT");
  } catch (error) {
    console.error("Error changing rfid_id type:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

changeRfidToBigInt();
