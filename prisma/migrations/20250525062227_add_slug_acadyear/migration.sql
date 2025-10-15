/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `courses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYear` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Made the column `endDate` on table `grade_configurations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `startDate` on table `grade_configurations` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- DropIndex
DROP INDEX "courses_code_key";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "academicYear" TEXT NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "status" "CourseStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "grade_configurations" ALTER COLUMN "endDate" SET NOT NULL,
ALTER COLUMN "endDate" DROP DEFAULT,
ALTER COLUMN "startDate" SET NOT NULL,
ALTER COLUMN "startDate" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");
