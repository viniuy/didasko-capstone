/*
  Warnings:

  - You are about to drop the `recitations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "recitations" DROP CONSTRAINT "recitations_courseId_fkey";

-- AlterTable
ALTER TABLE "criteria" ADD COLUMN     "isRecitationCriteria" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "recitations";
