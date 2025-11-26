/**
 * Script to fix incorrect maxScore values for assessments with linked criteria
 * Run with: npx tsx scripts/fix-maxscore.ts
 */

import { prisma } from "../lib/prisma";

async function fixMaxScores() {
  console.log("🔧 Fixing incorrect maxScore values...\n");

  try {
    // Get all assessments with linked criteria
    const assessmentsWithLinkedCriteria = await prisma.assessment.findMany({
      where: {
        linkedCriteriaId: { not: null },
      },
      include: {
        linkedCriteria: {
          include: {
            rubrics: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    let fixedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ assessmentId: string; error: string }> = [];

    for (const assessment of assessmentsWithLinkedCriteria) {
      if (!assessment.linkedCriteria) {
        console.log(
          `   ⚠️  Skipping assessment "${assessment.name}" (${assessment.id}) - criteria not found`
        );
        skippedCount++;
        continue;
      }

      const numberOfRubrics = assessment.linkedCriteria.rubrics.length;
      const scoringRange = Number(assessment.linkedCriteria.scoringRange) || 5;
      const expectedMaxScore = numberOfRubrics * scoringRange;
      const currentMaxScore = assessment.maxScore;

      if (currentMaxScore !== expectedMaxScore) {
        try {
          await prisma.assessment.update({
            where: { id: assessment.id },
            data: { maxScore: expectedMaxScore },
          });

          console.log(
            `   ✅ Fixed "${assessment.name}": ${currentMaxScore} → ${expectedMaxScore} (${numberOfRubrics} rubrics × ${scoringRange})`
          );
          fixedCount++;
        } catch (error: any) {
          console.error(
            `   ❌ Error fixing "${assessment.name}": ${error.message}`
          );
          errors.push({
            assessmentId: assessment.id,
            error: error.message,
          });
        }
      }
    }

    console.log("\n📊 Summary:");
    console.log(`   ✅ Fixed: ${fixedCount} assessment(s)`);
    console.log(`   ⚠️  Skipped: ${skippedCount} assessment(s)`);
    if (errors.length > 0) {
      console.log(`   ❌ Errors: ${errors.length} assessment(s)`);
      console.table(errors);
    }

    if (fixedCount > 0) {
      console.log("\n✅ MaxScore values have been fixed!");
    } else {
      console.log("\n✅ No fixes needed - all maxScore values are correct!");
    }
  } catch (error: any) {
    console.error("❌ Error fixing maxScore:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMaxScores();
