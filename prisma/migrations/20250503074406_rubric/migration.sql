/*
  Warnings:

  - You are about to drop the column `rubrics` on the `criteria` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "criteria" DROP COLUMN "rubrics";

-- CreateTable
CREATE TABLE "rubrics" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
