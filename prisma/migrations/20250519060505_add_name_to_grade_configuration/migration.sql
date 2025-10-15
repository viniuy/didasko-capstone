/*
  Warnings:

  - Added the required column `name` to the `grade_configurations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "grade_configurations" ADD COLUMN     "name" TEXT NOT NULL;
