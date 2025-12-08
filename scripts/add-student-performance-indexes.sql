-- ================================================================
-- ADDITIONAL PERFORMANCE INDEXES FOR STUDENT SEARCH
-- ================================================================
-- These indexes improve case-insensitive search performance
-- Run this directly on your database (not through Prisma migrate)

-- Case-insensitive indexes for ILIKE queries (improves search performance)
-- PostgreSQL can use these for queries with LOWER() or case-insensitive searches

CREATE INDEX CONCURRENTLY IF NOT EXISTS students_firstname_lower_idx 
ON students (LOWER(firstname));

CREATE INDEX CONCURRENTLY IF NOT EXISTS students_lastname_lower_idx 
ON students (LOWER(lastname));

CREATE INDEX CONCURRENTLY IF NOT EXISTS students_studentid_lower_idx 
ON students (LOWER(studentid));

-- Composite index for reverse name order (last name, first name)
-- Useful if you ever sort or search by last name first
CREATE INDEX CONCURRENTLY IF NOT EXISTS students_lastname_firstname_idx 
ON students (lastname, firstname);

-- Index for created_at for efficient pagination and sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS students_createdat_idx 
ON students (created_at);

-- Partial index for active RFID cards (non-null rfid_id)
-- More efficient than full index if many students don't have RFID cards
CREATE INDEX CONCURRENTLY IF NOT EXISTS students_rfid_notnull_idx 
ON students (rfid_id) 
WHERE rfid_id IS NOT NULL;

-- Index on _StudentCourses for course lookups (if not already exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "_StudentCourses_A_index" 
ON "_StudentCourses"("A");

-- ================================================================
-- ANALYZE TABLES AFTER INDEX CREATION
-- ================================================================
-- Update statistics for query planner

ANALYZE students;
ANALYZE "_StudentCourses";

-- ================================================================
-- VERIFY INDEX CREATION
-- ================================================================

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('students', '_StudentCourses')
ORDER BY tablename, indexname;
