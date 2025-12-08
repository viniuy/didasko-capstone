/**
 * Script to add performance indexes for student search optimization
 * Run this with: npx tsx scripts/add-student-indexes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addStudentIndexes() {
  console.log(
    "🔍 Checking and adding performance indexes for student queries...\n"
  );

  try {
    // Check existing indexes
    console.log("📊 Checking existing indexes on students table...");
    const existingIndexes = await prisma.$queryRaw<
      Array<{ indexname: string }>
    >`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'students'
      ORDER BY indexname;
    `;

    console.log(`✅ Found ${existingIndexes.length} existing indexes:`);
    existingIndexes.forEach((idx) => console.log(`   - ${idx.indexname}`));
    console.log("");

    // Add case-insensitive search indexes
    console.log("➕ Adding case-insensitive search indexes...");

    const indexes = [
      {
        name: "students_firstname_lower_idx",
        sql: 'CREATE INDEX IF NOT EXISTS students_firstname_lower_idx ON students (LOWER("firstName"))',
        description: "Case-insensitive firstName search",
      },
      {
        name: "students_lastname_lower_idx",
        sql: 'CREATE INDEX IF NOT EXISTS students_lastname_lower_idx ON students (LOWER("lastName"))',
        description: "Case-insensitive lastName search",
      },
      {
        name: "students_studentid_lower_idx",
        sql: 'CREATE INDEX IF NOT EXISTS students_studentid_lower_idx ON students (LOWER("studentId"))',
        description: "Case-insensitive studentId search",
      },
      {
        name: "students_lastname_firstname_idx",
        sql: 'CREATE INDEX IF NOT EXISTS students_lastname_firstname_idx ON students ("lastName", "firstName")',
        description: "Composite lastName-firstName for sorting",
      },
      {
        name: "students_createdat_idx",
        sql: "CREATE INDEX IF NOT EXISTS students_createdat_idx ON students (created_at)",
        description: "Pagination by creation date",
      },
      {
        name: "students_createdat_desc_idx",
        sql: "CREATE INDEX IF NOT EXISTS students_createdat_desc_idx ON students (created_at DESC)",
        description: "Descending order pagination (newest first)",
      },
      {
        name: "students_id_createdat_idx",
        sql: "CREATE INDEX IF NOT EXISTS students_id_createdat_idx ON students (id, created_at)",
        description: "Composite for efficient cursor pagination",
      },
      {
        name: "students_rfid_notnull_idx",
        sql: "CREATE INDEX IF NOT EXISTS students_rfid_notnull_idx ON students (rfid_id) WHERE rfid_id IS NOT NULL",
        description: "Partial index for non-null RFID",
      },
      {
        name: "_StudentCourses_A_index",
        sql: 'CREATE INDEX IF NOT EXISTS "_StudentCourses_A_index" ON "_StudentCourses"("A")',
        description: "Course-to-student lookup optimization",
      },
      {
        name: "_StudentCourses_B_index",
        sql: 'CREATE INDEX IF NOT EXISTS "_StudentCourses_B_index" ON "_StudentCourses"("B")',
        description: "Student-to-course lookup optimization",
      },
      {
        name: "_StudentCourses_AB_idx",
        sql: 'CREATE INDEX IF NOT EXISTS "_StudentCourses_AB_idx" ON "_StudentCourses"("A", "B")',
        description: "Composite index for relation queries",
      },
    ];

    for (const index of indexes) {
      try {
        console.log(`   Creating ${index.name}...`);
        await prisma.$executeRawUnsafe(index.sql);
        console.log(`   ✅ ${index.description}`);
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log(`   ⏭️  ${index.name} already exists, skipping`);
        } else {
          console.error(`   ❌ Error creating ${index.name}:`, error.message);
        }
      }
    }

    console.log("\n📈 Analyzing tables to update statistics...");
    await prisma.$executeRaw`ANALYZE students`;
    await prisma.$executeRaw`ANALYZE "_StudentCourses"`;
    console.log("✅ Table statistics updated\n");

    // Verify all indexes
    console.log("🔍 Verifying final index list...");
    const finalIndexes = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'students'
      ORDER BY indexname;
    `;

    console.log(`\n📋 Total indexes on students table: ${finalIndexes.length}`);
    finalIndexes.forEach((idx) => {
      console.log(`   ${idx.indexname}`);
    });

    // Get table stats
    console.log("\n📊 Table Statistics:");
    const stats = await prisma.$queryRaw<
      Array<{
        schemaname: string;
        relname: string;
        n_live_tup: bigint;
        n_dead_tup: bigint;
      }>
    >`
      SELECT 
        schemaname,
        relname,
        n_live_tup,
        n_dead_tup
      FROM pg_stat_user_tables
      WHERE relname = 'students';
    `;

    if (stats.length > 0) {
      console.log(
        `   Students table: ${stats[0].n_live_tup} rows (${stats[0].n_dead_tup} dead rows)`
      );
    }

    console.log("\n✅ Student search optimization complete!\n");
    console.log("💡 Performance improvements:");
    console.log("   - Case-insensitive searches will be faster");
    console.log("   - Name-based sorting will use indexes");
    console.log("   - RFID lookups optimized with partial index");
    console.log("   - Course-student relation queries improved\n");
  } catch (error) {
    console.error("❌ Error during index creation:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addStudentIndexes()
  .then(() => {
    console.log("🎉 Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
