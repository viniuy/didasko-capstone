/**
 * Script to check for data inconsistencies in the database
 * Run with: npx tsx scripts/check-data-inconsistencies.ts
 */

import { prisma } from "../lib/prisma";

async function checkInconsistencies() {
  console.log("🔍 Checking for data inconsistencies...\n");

  try {
    // 1. Check assessments with linkedCriteriaId that have incorrect maxScore
    console.log(
      "1️⃣ Checking assessments with linked criteria for incorrect maxScore...\n"
    );

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

    const incorrectMaxScores: Array<{
      assessmentId: string;
      assessmentName: string;
      currentMaxScore: number;
      expectedMaxScore: number;
      criteriaId: string;
      criteriaName: string;
      numberOfRubrics: number;
      scoringRange: number;
    }> = [];

    assessmentsWithLinkedCriteria.forEach((assessment) => {
      if (!assessment.linkedCriteria) {
        console.log(
          `   ⚠️  Assessment "${assessment.name}" (${assessment.id}) has linkedCriteriaId but criteria not found!`
        );
        return;
      }

      const numberOfRubrics = assessment.linkedCriteria.rubrics.length;
      const scoringRange = Number(assessment.linkedCriteria.scoringRange) || 5;
      const expectedMaxScore = numberOfRubrics * scoringRange;
      const currentMaxScore = assessment.maxScore;

      if (currentMaxScore !== expectedMaxScore) {
        incorrectMaxScores.push({
          assessmentId: assessment.id,
          assessmentName: assessment.name,
          currentMaxScore,
          expectedMaxScore,
          criteriaId: assessment.linkedCriteria.id,
          criteriaName: assessment.linkedCriteria.name,
          numberOfRubrics,
          scoringRange,
        });
      }
    });

    if (incorrectMaxScores.length > 0) {
      console.log(
        `   ❌ Found ${incorrectMaxScores.length} assessment(s) with incorrect maxScore:\n`
      );
      console.table(incorrectMaxScores);
      console.log("\n   💡 These assessments need to be updated.");
      console.log(
        "   The maxScore should be: numberOfRubrics × scoringRange\n"
      );
    } else {
      console.log(
        "   ✅ All assessments with linked criteria have correct maxScore!\n"
      );
    }

    // 2. Check for assessments with linkedCriteriaId but missing criteria
    console.log("2️⃣ Checking for orphaned linkedCriteriaId references...\n");

    const allAssessments = await prisma.assessment.findMany({
      where: {
        linkedCriteriaId: { not: null },
      },
      select: {
        id: true,
        name: true,
        linkedCriteriaId: true,
      },
    });

    const criteriaIds = new Set(
      allAssessments.map((a) => a.linkedCriteriaId).filter(Boolean) as string[]
    );

    const existingCriteria = await prisma.criteria.findMany({
      where: {
        id: { in: Array.from(criteriaIds) },
      },
      select: { id: true },
    });

    const existingCriteriaIds = new Set(existingCriteria.map((c) => c.id));
    const orphanedAssessments = allAssessments.filter(
      (a) => a.linkedCriteriaId && !existingCriteriaIds.has(a.linkedCriteriaId)
    );

    if (orphanedAssessments.length > 0) {
      console.log(
        `   ❌ Found ${orphanedAssessments.length} assessment(s) with orphaned linkedCriteriaId:\n`
      );
      console.table(orphanedAssessments);
      console.log(
        "\n   💡 These assessments reference criteria that don't exist.\n"
      );
    } else {
      console.log("   ✅ All linkedCriteriaId references are valid!\n");
    }

    // 3. Check for criteria without rubrics
    console.log("3️⃣ Checking for criteria without rubrics...\n");

    const criteriaWithoutRubrics = await prisma.criteria.findMany({
      include: {
        rubrics: true,
      },
    });

    const emptyCriteria = criteriaWithoutRubrics.filter(
      (c) => c.rubrics.length === 0
    );

    if (emptyCriteria.length > 0) {
      console.log(
        `   ⚠️  Found ${emptyCriteria.length} criteria without rubrics:\n`
      );
      console.table(
        emptyCriteria.map((c) => ({
          id: c.id,
          name: c.name,
          courseId: c.courseId,
        }))
      );
      console.log(
        "\n   💡 These criteria cannot be used for grading without rubrics.\n"
      );
    } else {
      console.log("   ✅ All criteria have rubrics!\n");
    }

    // 4. Check for criteria with linked assessments but incorrect maxScore
    console.log("4️⃣ Summary of issues found:\n");

    const totalIssues =
      incorrectMaxScores.length +
      orphanedAssessments.length +
      emptyCriteria.length;

    if (totalIssues === 0) {
      console.log("   ✅ No data inconsistencies found! Database is clean.\n");
    } else {
      console.log(`   📊 Total issues found: ${totalIssues}`);
      console.log(`      - Incorrect maxScore: ${incorrectMaxScores.length}`);
      console.log(`      - Orphaned references: ${orphanedAssessments.length}`);
      console.log(
        `      - Criteria without rubrics: ${emptyCriteria.length}\n`
      );

      if (incorrectMaxScores.length > 0) {
        console.log("   🔧 To fix incorrect maxScore, run:");
        console.log("      npx tsx scripts/fix-maxscore.ts\n");
      }
    }
  } catch (error: any) {
    console.error("❌ Error checking inconsistencies:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInconsistencies();
