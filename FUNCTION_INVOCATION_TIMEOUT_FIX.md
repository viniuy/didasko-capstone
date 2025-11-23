# FUNCTION_INVOCATION_TIMEOUT Error - Root Cause Analysis & Fix

## 1. The Fix

### Changes Made

1. **Added Database Indexes** (`prisma/schema.prisma`)

   - Added `@@index([courseId])` - Fast lookups by course
   - Added `@@index([courseId, isGroupCriteria])` - Optimized composite index for group criteria queries
   - Added `@@index([courseId, isRecitationCriteria])` - Optimized composite index for recitation queries
   - Added `@@index([isGroupCriteria])` and `@@index([isRecitationCriteria])` - Additional single-column indexes

2. **Optimized Database Query** (`lib/services/criteria.ts`)

   - Changed from 3 separate queries to 1 optimized query with `include`
   - Removed manual batching of rubrics (Prisma handles this efficiently with includes)
   - Leverages database joins instead of multiple round trips

3. **Added Timeout Protection** (`app/api/courses/[course_slug]/group-criteria/route.ts`)
   - Added `withTimeout` helper function
   - Provides better error messages if queries are slow
   - Returns 504 status code for timeout errors

### Next Steps

1. **Run Database Migration:**

   ```bash
   npx prisma migrate dev --name add_criteria_indexes
   ```

2. **Deploy to Production:**

   ```bash
   npx prisma migrate deploy
   ```

3. **Monitor Performance:**
   - Check Vercel function logs for execution times
   - Monitor database query performance
   - Verify indexes are being used (check query plans)

---

## 2. Root Cause Explanation

### What Was Actually Happening

Your API route `/api/courses/[course_slug]/group-criteria` was calling `getGroupCriteria()`, which:

1. **Made 3 separate database queries:**

   - Query 1: Find course by slug
   - Query 2: Find all criteria with `isGroupCriteria: true` for that course
   - Query 3: Find all rubrics for those criteria

2. **Performed full table scans:**

   - Without indexes on `courseId` and `isGroupCriteria`, PostgreSQL had to scan the entire `criteria` table
   - For each row, it checked if `courseId` matched AND `isGroupCriteria` was true
   - With hundreds or thousands of criteria records, this became exponentially slower

3. **Hit Vercel's timeout limit:**
   - On Vercel Hobby plan: 10 seconds default timeout
   - On Vercel Pro/Enterprise: 60 seconds default (your `maxDuration = 30` only works on Pro+)
   - The slow query exceeded the timeout, causing `FUNCTION_INVOCATION_TIMEOUT`

### What It Needed to Do

The function needed to:

1. Use indexed queries for fast lookups
2. Minimize database round trips
3. Complete within Vercel's timeout limits
4. Handle edge cases gracefully

### Conditions That Triggered This

- **Large dataset**: Courses with many criteria (50+)
- **Missing indexes**: No database indexes on frequently queried columns
- **Inefficient query pattern**: Multiple queries instead of optimized joins
- **Vercel plan limits**: Hobby plan's 10-second timeout is strict

### The Misconception

**The misconception was:** "Database queries are fast, indexes aren't necessary for small tables"

**The reality:**

- Even "small" tables (1000+ rows) need indexes for filtered queries
- Composite indexes (`courseId + isGroupCriteria`) are crucial for WHERE clauses with multiple conditions
- Without indexes, PostgreSQL does sequential scans that get slower as data grows
- Serverless functions have strict timeout limits that don't tolerate slow queries

---

## 3. Teaching the Concept

### Why This Error Exists

**FUNCTION_INVOCATION_TIMEOUT** exists to:

1. **Prevent resource exhaustion**: Serverless platforms need to ensure no single function monopolizes resources
2. **Maintain system stability**: Long-running functions can cause cascading failures
3. **Enforce cost controls**: Serverless pricing is based on execution time
4. **Protect against infinite loops**: Prevents runaway code from running forever

### The Correct Mental Model

Think of serverless functions as **"stateless, short-lived workers"**:

```
┌─────────────────────────────────────────┐
│  Client Request                         │
│         ↓                               │
│  Vercel Function (Serverless)           │
│  ├─ Cold Start: 200-500ms              │
│  ├─ Your Code: Must complete quickly    │
│  └─ Timeout: 10s (Hobby) / 60s (Pro)   │
│         ↓                               │
│  Response (or Timeout Error)            │
└─────────────────────────────────────────┘
```

**Key principles:**

- **Fast is better than perfect**: Optimize for speed, not completeness
- **Index everything you query**: Database indexes are not optional
- **Batch operations**: Minimize round trips to external services
- **Fail fast**: Use timeouts to detect problems early

### How This Fits Into Serverless Architecture

Serverless functions are designed for:

- ✅ **Short, stateless operations** (< 10 seconds ideally)
- ✅ **High concurrency** (many requests in parallel)
- ✅ **Automatic scaling** (spawn new instances as needed)

They're NOT designed for:

- ❌ **Long-running processes** (> 60 seconds)
- ❌ **Stateful operations** (maintain connection state)
- ❌ **Heavy computations** (CPU-intensive tasks)

**The timeout is a feature, not a bug** - it forces you to write efficient, scalable code.

---

## 4. Warning Signs to Recognize

### Code Smells That Indicate Timeout Risk

1. **Missing Database Indexes**

   ```typescript
   // ❌ BAD: Querying without indexes
   await prisma.criteria.findMany({
     where: { courseId: id, isGroupCriteria: true },
   });
   // If no index on (courseId, isGroupCriteria), this scans entire table
   ```

2. **Multiple Sequential Queries**

   ```typescript
   // ❌ BAD: N+1 query pattern
   const criteria = await getCriteria();
   for (const c of criteria) {
     const rubrics = await getRubrics(c.id); // Query per item!
   }
   ```

3. **No Query Limits**

   ```typescript
   // ❌ BAD: Fetching unlimited data
   await prisma.criteria.findMany({}); // Could return 10,000+ records
   ```

4. **Synchronous Blocking Operations**

   ```typescript
   // ❌ BAD: Blocking the event loop
   for (let i = 0; i < 1000000; i++) {
     heavyComputation(); // Blocks function execution
   }
   ```

5. **External API Calls Without Timeouts**
   ```typescript
   // ❌ BAD: No timeout protection
   const data = await fetch("https://slow-api.com/data");
   // If API is slow, your function times out
   ```

### Patterns That Work Well

1. **Indexed Queries**

   ```typescript
   // ✅ GOOD: Uses database indexes
   await prisma.criteria.findMany({
     where: { courseId: id, isGroupCriteria: true },
   });
   // With @@index([courseId, isGroupCriteria]), this is fast
   ```

2. **Single Query with Includes**

   ```typescript
   // ✅ GOOD: One query with joins
   await prisma.criteria.findMany({
     where: { courseId: id },
     include: { rubrics: true }, // Prisma handles join efficiently
   });
   ```

3. **Query Limits and Pagination**

   ```typescript
   // ✅ GOOD: Limited results
   await prisma.criteria.findMany({
     take: 50,
     skip: 0,
     orderBy: { createdAt: "desc" },
   });
   ```

4. **Timeout Protection**
   ```typescript
   // ✅ GOOD: Explicit timeout
   const result = await Promise.race([
     slowOperation(),
     new Promise((_, reject) =>
       setTimeout(() => reject(new Error("Timeout")), 5000)
     ),
   ]);
   ```

### Similar Mistakes to Avoid

1. **Forgetting indexes on foreign keys**: Always index `courseId`, `userId`, etc.
2. **Querying without WHERE clauses**: Use filters to limit results
3. **Fetching entire relations**: Use `select` to limit fields
4. **Ignoring Vercel plan limits**: Hobby plan has strict timeouts
5. **No error handling for timeouts**: Always handle timeout errors gracefully

---

## 5. Alternative Approaches & Trade-offs

### Approach 1: Database Indexes (✅ Implemented)

**What:** Add indexes to frequently queried columns

**Pros:**

- Dramatically faster queries (10-1000x speedup)
- No code changes needed
- Works for all queries using those columns
- Minimal overhead (slightly slower writes)

**Cons:**

- Requires database migration
- Slightly increased storage space
- Write operations slightly slower (indexes must be updated)

**When to use:** Always for filtered queries on large tables

---

### Approach 2: Query Optimization (✅ Implemented)

**What:** Use single query with `include` instead of multiple queries

**Pros:**

- Fewer database round trips
- Database handles joins efficiently
- Simpler code
- Better performance

**Cons:**

- Slightly more complex Prisma query
- May fetch more data than needed (can use `select` to limit)

**When to use:** When fetching related data (like criteria + rubrics)

---

### Approach 3: Caching (⚠️ Consider for Future)

**What:** Cache query results in Redis or memory

**Pros:**

- Near-instant responses for cached data
- Reduces database load
- Better user experience

**Cons:**

- Added complexity (cache invalidation)
- Stale data risk
- Additional infrastructure cost
- Not suitable for frequently changing data

**When to use:** For data that changes infrequently (e.g., course metadata)

**Example:**

```typescript
// Using Next.js cache (built-in)
import { cache } from 'react';

export const getGroupCriteria = cache(async (courseSlug: string) => {
  // This will be cached per request
  return await prisma.criteria.findMany({...});
});
```

---

### Approach 4: Background Jobs (⚠️ For Long Operations)

**What:** Move slow operations to background job queue

**Pros:**

- No timeout limits
- Better user experience (async processing)
- Can handle very long operations

**Cons:**

- Complex architecture
- Requires job queue (Bull, BullMQ, etc.)
- User must wait for results
- Overkill for simple queries

**When to use:** For operations that take > 30 seconds (e.g., generating reports)

**Example:**

```typescript
// Using a job queue
await jobQueue.add("fetch-group-criteria", { courseSlug });
// Function returns immediately, job processes in background
```

---

### Approach 5: Upgrade Vercel Plan (⚠️ Last Resort)

**What:** Upgrade from Hobby to Pro plan

**Pros:**

- Longer timeout (60 seconds)
- More resources
- Better performance monitoring

**Cons:**

- Costs money ($20/month)
- Doesn't fix underlying performance issues
- Still has timeout limits (just longer)

**When to use:** Only if you genuinely need > 10 seconds AND can't optimize further

---

### Approach 6: Direct Database Connection (⚠️ Not Recommended)

**What:** Use connection pooling or direct connections

**Pros:**

- Potentially faster connections
- More control over connection management

**Cons:**

- Complex setup
- Risk of connection pool exhaustion
- Doesn't solve slow query problem
- Prisma already handles this well

**When to use:** Only if you have specific connection issues (not your case)

---

## Recommended Solution Stack

For your use case, the **optimal approach** is:

1. ✅ **Database Indexes** (implemented) - Essential for performance
2. ✅ **Query Optimization** (implemented) - Reduces round trips
3. ✅ **Timeout Protection** (implemented) - Better error handling
4. ⚠️ **Consider Caching** (future) - If data doesn't change frequently
5. ❌ **Avoid Background Jobs** - Overkill for this use case
6. ❌ **Avoid Plan Upgrade** - Fix the root cause first

---

## Testing the Fix

After applying the migration, test with:

```typescript
// Test query performance
const start = Date.now();
const criteria = await getGroupCriteria("your-course-slug");
const duration = Date.now() - start;
console.log(`Query took ${duration}ms`); // Should be < 100ms for most cases
```

**Expected results:**

- Before: 5-10+ seconds (timeout)
- After: 50-200ms (fast)

---

## Monitoring & Prevention

### Set Up Alerts

1. **Vercel Function Duration:**

   - Alert if function takes > 5 seconds
   - Monitor p95 and p99 latencies

2. **Database Query Performance:**

   - Use Prisma query logging in development
   - Monitor slow query logs in production

3. **Error Rates:**
   - Track FUNCTION_INVOCATION_TIMEOUT errors
   - Alert if timeout rate > 1%

### Best Practices Going Forward

1. **Always add indexes** for WHERE clause columns
2. **Use composite indexes** for multi-column WHERE clauses
3. **Test with realistic data volumes** (not just 10 records)
4. **Monitor query performance** in production
5. **Set query timeouts** to fail fast
6. **Use `select` and `take`** to limit data fetched
7. **Batch operations** to minimize round trips

---

## Summary

**The Problem:** Slow database queries without indexes caused function timeouts

**The Solution:** Add indexes + optimize queries + add timeout protection

**The Lesson:** Serverless functions require efficient code. Database indexes are not optional - they're essential for performance.

**The Prevention:** Always index filtered columns, monitor performance, and test with realistic data volumes.
