/*
  Warnings:

  - Added the required column `number` to the `groups` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "number" TEXT NOT NULL;
