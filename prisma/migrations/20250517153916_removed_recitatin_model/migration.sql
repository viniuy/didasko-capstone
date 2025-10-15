/*
  Warnings:

  - You are about to drop the `recitations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "recitations" DROP CONSTRAINT "recitations_courseId_fkey";

-- DropTable
DROP TABLE "recitations";
