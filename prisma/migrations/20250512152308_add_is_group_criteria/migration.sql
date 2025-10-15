/*
  Warnings:

  - You are about to drop the column `leaderId` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `students` table. All the data in the column will be lost.
  - You are about to drop the `_GroupStudents` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name,courseId]` on the table `groups` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `groups` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "_GroupStudents" DROP CONSTRAINT "_GroupStudents_A_fkey";

-- DropForeignKey
ALTER TABLE "_GroupStudents" DROP CONSTRAINT "_GroupStudents_B_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_leaderId_fkey";

-- DropIndex
DROP INDEX "students_studentId_key";

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "leaderId",
DROP COLUMN "number",
ADD COLUMN     "creationMethod" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "rubrics" ADD COLUMN     "isGroupCriteria" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "students" DROP COLUMN "studentId";

-- DropTable
DROP TABLE "_GroupStudents";

-- CreateTable
CREATE TABLE "_StudentGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StudentGroups_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_StudentGroups_B_index" ON "_StudentGroups"("B");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_courseId_key" ON "groups"("name", "courseId");

-- AddForeignKey
ALTER TABLE "_StudentGroups" ADD CONSTRAINT "_StudentGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentGroups" ADD CONSTRAINT "_StudentGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
