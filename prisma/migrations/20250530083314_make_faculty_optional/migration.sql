/*
  Warnings:

  - You are about to drop the column `facultyId` on the `courses` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_facultyId_fkey";

-- AlterTable
ALTER TABLE "course_schedules" ALTER COLUMN "day" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "facultyId",
ADD COLUMN     "faculty_id" TEXT;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
