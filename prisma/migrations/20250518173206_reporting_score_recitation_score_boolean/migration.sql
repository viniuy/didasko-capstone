/*
  Warnings:

  - Added the required column `recitationScore` to the `grades` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reportingScore` to the `grades` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "grades" DROP COLUMN "recitationScore",
ADD COLUMN     "recitationScore" BOOLEAN NOT NULL,
DROP COLUMN "reportingScore",
ADD COLUMN     "reportingScore" BOOLEAN NOT NULL;
