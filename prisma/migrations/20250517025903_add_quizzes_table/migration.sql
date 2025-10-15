-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "quizDate" TIMESTAMP(3) NOT NULL,
    "attendanceRangeStart" TIMESTAMP(3) NOT NULL,
    "attendanceRangeEnd" TIMESTAMP(3) NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "passingRate" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_scores" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "attendance" TEXT NOT NULL,
    "plusPoints" DOUBLE PRECISION NOT NULL,
    "totalGrade" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quizzes_courseId_idx" ON "quizzes"("courseId");

-- CreateIndex
CREATE INDEX "quizzes_attendanceRangeStart_idx" ON "quizzes"("attendanceRangeStart");

-- CreateIndex
CREATE INDEX "quizzes_attendanceRangeEnd_idx" ON "quizzes"("attendanceRangeEnd");

-- CreateIndex
CREATE INDEX "quiz_scores_quizId_idx" ON "quiz_scores"("quizId");

-- CreateIndex
CREATE INDEX "quiz_scores_studentId_idx" ON "quiz_scores"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_scores_quizId_studentId_key" ON "quiz_scores"("quizId", "studentId");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_scores" ADD CONSTRAINT "quiz_scores_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_scores" ADD CONSTRAINT "quiz_scores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
