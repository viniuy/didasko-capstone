/**
 * Script to verify database indexes are created
 * Run with: npx tsx scripts/verify-indexes.ts
 */

import { prisma } from "../lib/prisma";

async function verifyIndexes() {
  console.log("🔍 Checking database indexes...\n");

  try {
    // Check if we can query with the indexes
    // This will be fast if indexes exist, slow if they don't
    const start = Date.now();

    const testResult = await prisma.$queryRaw`
      SELECT 
        indexname,
        indexdef
      FROM 
        pg_indexes
      WHERE 
        tablename = 'criteria'
        AND (
          indexdef LIKE '%courseId%' 
          OR indexdef LIKE '%isGroupCriteria%'
          OR indexdef LIKE '%isRecitationCriteria%'
        )
      ORDER BY 
        indexname;
    `;

    const queryTime = Date.now() - start;

    console.log("📊 Indexes found on 'criteria' table:\n");
    console.table(testResult);

    // Check for the critical composite index
    const compositeIndex = await prisma.$queryRaw`
      SELECT 
        indexname,
        indexdef
      FROM 
        pg_indexes
      WHERE 
        tablename = 'criteria'
        AND indexdef LIKE '%courseId%'
        AND indexdef LIKE '%isGroupCriteria%';
    `;

    if (Array.isArray(compositeIndex) && compositeIndex.length > 0) {
      console.log("\n✅ CRITICAL INDEX FOUND:");
      console.log("   Composite index (courseId, isGroupCriteria) exists!");
      console.log(`   Index name: ${(compositeIndex[0] as any).indexname}`);
    } else {
      console.log(
        "\n❌ WARNING: Composite index (courseId, isGroupCriteria) NOT FOUND!"
      );
      console.log("   This index is critical for performance!");
    }

    // Test query performance
    console.log("\n⚡ Testing query performance...");
    const perfStart = Date.now();

    // Get a course slug for testing
    const testCourse = await prisma.course.findFirst({
      select: { slug: true },
    });

    if (testCourse) {
      const criteriaStart = Date.now();
      await prisma.criteria.findMany({
        where: {
          course: { slug: testCourse.slug },
          isGroupCriteria: true,
        },
        take: 1, // Just test, don't fetch all
      });
      const criteriaTime = Date.now() - criteriaStart;

      console.log(`   Query time: ${criteriaTime}ms`);
      if (criteriaTime < 200) {
        console.log("   ✅ Query is FAST - indexes are working!");
      } else if (criteriaTime < 1000) {
        console.log("   ⚠️  Query is MODERATE - indexes may not be optimal");
      } else {
        console.log("   ❌ Query is SLOW - indexes may be missing!");
      }
    }

    console.log(
      `\n✅ Verification complete (total time: ${Date.now() - start}ms)`
    );
  } catch (error: any) {
    console.error("❌ Error verifying indexes:", error.message);
    console.error("\n💡 Try running this SQL directly in Supabase SQL Editor:");
    console.error("   See scripts/verify-indexes.sql");
  } finally {
    await prisma.$disconnect();
  }
}

verifyIndexes();
