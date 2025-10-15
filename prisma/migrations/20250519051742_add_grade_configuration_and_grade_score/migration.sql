-- CreateTable
CREATE TABLE "grade_configurations" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "reportingWeight" DOUBLE PRECISION NOT NULL,
    "recitationWeight" DOUBLE PRECISION NOT NULL,
    "quizWeight" DOUBLE PRECISION NOT NULL,
    "passingThreshold" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_scores" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "reportingScore" DOUBLE PRECISION,
    "recitationScore" DOUBLE PRECISION,
    "quizScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_scores_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "grade_configurations" ADD CONSTRAINT "grade_configurations_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_scores" ADD CONSTRAINT "grade_scores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_scores" ADD CONSTRAINT "grade_scores_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_scores" ADD CONSTRAINT "grade_scores_configId_fkey" FOREIGN KEY ("configId") REFERENCES "grade_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
