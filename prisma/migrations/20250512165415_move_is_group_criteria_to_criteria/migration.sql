/*
  Warnings:

  - You are about to drop the column `isGroupCriteria` on the `rubrics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "criteria" ADD COLUMN     "isGroupCriteria" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rubrics" DROP COLUMN "isGroupCriteria";
