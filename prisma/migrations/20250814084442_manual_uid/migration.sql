/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `students` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "students_id_key" ON "students"("id");
