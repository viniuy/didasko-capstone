/*
  Warnings:

  - You are about to drop the column `creationMethod` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the `_StudentGroups` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_StudentGroups" DROP CONSTRAINT "_StudentGroups_A_fkey";

-- DropForeignKey
ALTER TABLE "_StudentGroups" DROP CONSTRAINT "_StudentGroups_B_fkey";

-- DropIndex
DROP INDEX "groups_name_courseId_key";

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "creationMethod",
DROP COLUMN "description",
DROP COLUMN "isActive",
ADD COLUMN     "leaderId" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- DropTable
DROP TABLE "_StudentGroups";

-- CreateTable
CREATE TABLE "_GroupStudents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GroupStudents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GroupStudents_B_index" ON "_GroupStudents"("B");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupStudents" ADD CONSTRAINT "_GroupStudents_A_fkey" FOREIGN KEY ("A") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupStudents" ADD CONSTRAINT "_GroupStudents_B_fkey" FOREIGN KEY ("B") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
