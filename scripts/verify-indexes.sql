-- Verify indexes on Criteria table
-- Run this in Supabase SQL Editor

-- Check all indexes on the criteria table
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'criteria'
ORDER BY 
    indexname;

-- Specifically check for our composite indexes
SELECT 
    i.relname AS index_name,
    a.attname AS column_name,
    am.amname AS index_type
FROM 
    pg_class t,
    pg_class i,
    pg_index ix,
    pg_attribute a,
    pg_am am
WHERE 
    t.oid = ix.indrelid
    AND i.oid = ix.indexrelid
    AND a.attrelid = t.oid
    AND a.attnum = ANY(ix.indkey)
    AND t.relkind = 'r'
    AND t.relname = 'criteria'
    AND am.oid = i.relam
ORDER BY 
    i.relname, a.attnum;

-- Check if composite index exists (most important one)
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'criteria'
    AND indexdef LIKE '%courseId%'
    AND indexdef LIKE '%isGroupCriteria%';

