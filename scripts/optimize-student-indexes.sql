-- ================================================================
-- STUDENT TABLE INDEX OPTIMIZATION
-- ================================================================
-- This script verifies and creates indexes for optimal student query performance
-- Run this script directly against your database to ensure all indexes exist

-- 1. Check existing indexes on students table
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'students'
ORDER BY indexname;

-- 2. Check existing indexes on _StudentCourses join table
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = '_StudentCourses'
ORDER BY indexname;

-- ================================================================
-- CREATE MISSING INDEXES (if not exist)
-- ================================================================

-- These indexes should already exist from Prisma schema, but we'll ensure they're there
-- Using CREATE INDEX IF NOT EXISTS for safety

-- Single column indexes for exact matches and sorting
CREATE INDEX IF NOT EXISTS students_firstName_idx ON students(firstName);
CREATE INDEX IF NOT EXISTS students_lastName_idx ON students(lastName);
CREATE INDEX IF NOT EXISTS students_studentId_idx ON students(studentId);
CREATE INDEX IF NOT EXISTS students_rfid_id_idx ON students(rfid_id);

-- Composite index for full name searches (most common query pattern)
CREATE INDEX IF NOT EXISTS students_firstName_lastName_idx ON students(firstName, lastName);

-- Case-insensitive search indexes using LOWER() for better search performance
-- These are additional to what Prisma creates for case-insensitive searches
CREATE INDEX IF NOT EXISTS students_firstName_lower_idx ON students(LOWER(firstName));
CREATE INDEX IF NOT EXISTS students_lastName_lower_idx ON students(LOWER(lastName));
CREATE INDEX IF NOT EXISTS students_studentId_lower_idx ON students(LOWER(studentId));

-- Composite index for reverse name searches (last name first)
CREATE INDEX IF NOT EXISTS students_lastName_firstName_idx ON students(lastName, firstName);

-- Index for pagination (created_at is often used for default ordering)
CREATE INDEX IF NOT EXISTS students_createdAt_idx ON students(created_at);

-- Index on _StudentCourses for course-to-student lookups (student-to-course already indexed)
-- Column A = courseId, Column B = studentId
CREATE INDEX IF NOT EXISTS "_StudentCourses_A_index" ON "_StudentCourses"("A");
-- B index should already exist from Prisma, but ensure it's there
CREATE INDEX IF NOT EXISTS "_StudentCourses_B_index" ON "_StudentCourses"("B");

-- ================================================================
-- ANALYZE QUERY PERFORMANCE
-- ================================================================

-- Test query performance for common search patterns
EXPLAIN ANALYZE
SELECT * FROM students 
WHERE LOWER(firstName) LIKE LOWER('%test%') 
   OR LOWER(lastName) LIKE LOWER('%test%')
LIMIT 50;

-- Test RFID lookup performance
EXPLAIN ANALYZE
SELECT * FROM students 
WHERE rfid_id = 12345
LIMIT 1;

-- Test student ID lookup performance
EXPLAIN ANALYZE
SELECT * FROM students 
WHERE LOWER(studentId) = LOWER('2024-00001')
LIMIT 1;

-- ================================================================
-- VERIFY ALL INDEXES
-- ================================================================

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('students', '_StudentCourses')
ORDER BY tablename, indexname;

-- Show table statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('students', '_StudentCourses');

-- ================================================================
-- RECOMMENDATIONS
-- ================================================================
-- After creating indexes, run:
-- VACUUM ANALYZE students;
-- VACUUM ANALYZE "_StudentCourses";
--
-- This updates PostgreSQL statistics for optimal query planning
