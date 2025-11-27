# Connection Pool & OAuth Audit Report

**Generated:** $(date)  
**Scope:** Full codebase scan for connection pool exhaustion and Azure AD OAuth issues

---

## 🔴 CRITICAL ISSUES

### 1. **Azure AD OAuth Duplicate Code Redemption**

**Location:** `app/api/auth/[...nextauth]/route.ts`

**Issues Found:**

- ❌ **No explicit `redirectUri`** in AzureADProvider configuration (line 32-42)
- ❌ **No `NEXTAUTH_URL` validation** - relies on automatic detection
- ❌ **No idempotency check** in `signIn` callback - could process same OAuth code twice
- ❌ **Multiple database operations** in signIn callback (lines 61-199) without transaction protection
- ⚠️ **Potential race condition** - account creation/update could happen twice if callback is called concurrently

**Risk Level:** 🔴 **CRITICAL** - Causes OAuth failures

**Impact:**

- Azure AD blocks duplicate code redemption attempts
- Users cannot sign in
- Connection pool may be exhausted from retry attempts

---

### 2. **Unpaginated Queries Loading All Records**

**Location:** `app/api/logs/route.ts` (lines 132-147)

**Issue:**

```typescript
// Returns ALL audit logs without pagination if no pagination params
logs = await prisma.auditLog.findMany({
  where,
  include: { user: { select: {...} } },
  orderBy: { createdAt: "desc" },
  // ❌ NO take/skip - loads ALL records
});
```

**Risk Level:** 🔴 **HIGH** - Could load thousands of records in one query

**Impact:**

- Holds connection for extended period
- High memory usage
- Slow response times
- Connection pool exhaustion under load

**Recommendation:** Always enforce pagination (default limit: 100)

---

### 3. **Large Nested Queries Without Limits**

**Location:** `app/api/stats/grades/leaderboard/route.ts` (lines 163-214)

**Issue:**

```typescript
// Loads ALL term grades for ALL courses of a faculty
const termGrades = await prisma.termGrade.findMany({
  where: {
    termConfig: { courseId: { in: courseIds } },
    totalPercentage: { not: null },
  },
  select: { ... },
  // ❌ NO limit - could be thousands of records
});

// Then loads ALL term configs with nested assessments
const termConfigs = await prisma.termConfiguration.findMany({
  where: { courseId: { in: courseIds } },
  include: {
    assessments: { ... }, // Nested query
    course: { ... },
  },
  // ❌ NO limit
});
```

**Risk Level:** 🟡 **MEDIUM-HIGH** - Depends on faculty course count

**Impact:**

- Multiple large queries in sequence
- Nested includes multiply data size
- Connection held during entire operation

---

### 4. **Deeply Nested Includes in Single Query**

**Location:** `lib/services/grading.ts` (lines 623-649)

**Issue:**

```typescript
prisma.grade.findMany({
  where: { courseId: course.id },
  select: {
    studentId: true,
    criteriaId: true,
    value: true,
    scores: true,
    total: true,
    criteria: {
      select: {
        id: true,
        scoringRange: true,
        rubrics: {
          // ❌ Nested 3 levels deep
          select: { id: true, name: true, percentage: true },
          orderBy: { createdAt: "asc" },
        },
      },
    },
  },
  // ❌ NO limit - loads all grades for all students
});
```

**Risk Level:** 🟡 **MEDIUM** - Depends on class size

**Impact:**

- Complex join query
- Large result set with nested data
- Connection held during query execution

---

### 5. **Promise.all with Unbounded Parallel Queries**

**Location:** `app/api/stats/grades/leaderboard/route.ts` (lines 191-198)

**Issue:**

```typescript
// Parallel queries for ALL courses - no limit
await Promise.all(
  courses.map(async (course) => {
    const scores = await getAssessmentScores(course.slug);
    // Each call makes its own database queries
  })
);
```

**Risk Level:** 🟡 **MEDIUM** - Could create many concurrent connections

**Impact:**

- If faculty has 20+ courses, creates 20+ parallel database connections
- Each `getAssessmentScores` makes multiple queries
- Could exhaust connection pool quickly

---

## 🟡 MEDIUM PRIORITY ISSUES

### 6. **Transaction Without Timeout**

**Location:** `lib/services/grading.ts` (line 445)

**Issue:**

```typescript
const results = await prisma.$transaction(
  [...operations]
  // ❌ NO timeout specified
);
```

**Risk Level:** 🟡 **MEDIUM** - Transaction could hang indefinitely

**Impact:**

- Connection held for entire transaction duration
- No timeout protection
- Could block other requests

---

### 7. **JWT Callback Database Query on Every Request**

**Location:** `app/api/auth/[...nextauth]/route.ts` (lines 260-283)

**Issue:**

```typescript
// Fallback sync from DB if missing
if (token?.email && !token?.role) {
  const dbUser = await prisma.user.findUnique({
    where: { email: token.email },
    // ❌ Runs on every request if role is missing
  });
}
```

**Risk Level:** 🟡 **MEDIUM** - Could run frequently

**Impact:**

- Additional query on every authenticated request
- Adds latency
- Uses connection from pool

**Note:** This is a fallback, but should be rare. Consider caching or better token management.

---

### 8. **Separate Prisma Instance for Audit Logging**

**Location:** `lib/audit.ts` (lines 8-28)

**Issue:**

```typescript
// Creates separate PrismaClient instance
auditPrisma = new PrismaClient({
  // Uses same DATABASE_URL but separate connection pool
});
```

**Risk Level:** 🟢 **LOW-MEDIUM** - Separate pool is intentional but uses more connections

**Impact:**

- Uses additional connections from database
- Could contribute to pool exhaustion if audit logging is frequent

**Note:** This is intentional to prevent recursion, but should be monitored.

---

## ✅ GOOD PRACTICES FOUND

1. ✅ **Most queries use `select` instead of `include`** - Reduces data transfer
2. ✅ **Some queries use `_count`** - Avoids loading full relations
3. ✅ **Transactions have timeouts in some places** - `app/api/courses/[course_slug]/attendance/batch/route.ts`
4. ✅ **Caching used for expensive queries** - `unstable_cache` in several services
5. ✅ **Batch operations used** - `createMany`, `updateMany` where appropriate
6. ✅ **No middleware interfering** - No `middleware.ts` found

---

## 📊 STATISTICS

- **Total Prisma queries found:** 113+ across 45 API route files
- **Queries without pagination:** 3+ identified
- **Deep nested includes (3+ levels):** 2+ identified
- **Unbounded Promise.all:** 1+ identified
- **Transactions without timeout:** 1+ identified

---

## 🎯 RECOMMENDED FIXES (Priority Order)

### **Priority 1: Azure AD OAuth (CRITICAL)**

1. Add explicit `redirectUri` to AzureADProvider
2. Add idempotency check in `signIn` callback
3. Wrap account operations in transaction
4. Verify `NEXTAUTH_URL` is set correctly in Vercel

### **Priority 2: Unpaginated Queries (HIGH)**

1. Enforce pagination in `app/api/logs/route.ts` (default limit: 100)
2. Add maximum limit (e.g., 1000) even when pagination is optional

### **Priority 3: Large Leaderboard Queries (MEDIUM-HIGH)**

1. Add limits to `termGrades.findMany` query
2. Consider pagination or cursor-based pagination
3. Add query timeout protection

### **Priority 4: Deep Nested Queries (MEDIUM)**

1. Consider splitting `getClassRecordData` into multiple smaller queries
2. Add limits where appropriate
3. Use `select` more aggressively to reduce data size

### **Priority 5: Transaction Timeouts (MEDIUM)**

1. Add timeout to all `$transaction` calls
2. Use `maxWait` and `timeout` options consistently

### **Priority 6: Parallel Query Limits (MEDIUM)**

1. Limit concurrent queries in `Promise.all` (e.g., batch of 5-10)
2. Consider using `p-limit` or similar library

---

## 🔍 VERIFICATION CHECKLIST

### Azure AD OAuth

- [ ] `NEXTAUTH_URL` set in Vercel environment variables
- [ ] Redirect URI in Azure AD matches exactly: `https://your-domain.vercel.app/api/auth/callback/azure-ad`
- [ ] No duplicate callback attempts in logs
- [ ] Idempotency check added to signIn callback

### Connection Pool

- [ ] `DATABASE_URL` includes connection pool parameters: `?connection_limit=20&pool_timeout=30`
- [ ] All large queries have limits or pagination
- [ ] All transactions have timeouts
- [ ] No unbounded `Promise.all` with database queries

---

## 📝 NOTES

- Most queries are well-optimized using `select` instead of `include`
- Caching is used appropriately in several places
- The codebase generally follows good practices
- Main issues are:
  1. OAuth callback handling (critical)
  2. A few unpaginated queries (high risk)
  3. Some large queries without limits (medium risk)

---

**Next Steps:**

1. Fix Azure AD OAuth issues immediately (blocking)
2. Add pagination to unpaginated queries
3. Add limits to large queries
4. Add transaction timeouts
5. Monitor connection pool usage after fixes
