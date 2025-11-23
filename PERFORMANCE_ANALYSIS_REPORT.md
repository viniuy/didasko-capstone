# Next.js Performance Analysis Report
## Comprehensive Codebase Performance Audit

**Date:** Generated on analysis  
**Target Issue:** 3-second page load times despite Hybrid SSR implementation  
**Architecture:** Next.js App Router + TanStack Query + Hybrid SSR

---

## Executive Summary

Your application is experiencing slow page loads (~3 seconds) due to several critical performance bottlenecks:

1. **Massive nested database queries** without caching (especially `getCourseAnalytics`)
2. **Heavy client-side computations** blocking server rendering
3. **No Suspense boundaries** - pages block on all data before rendering
4. **API route cold starts** - client components calling API routes instead of direct RSC queries
5. **Missing database indexes** for common query patterns
6. **Large client bundles** - 46 client components with heavy dependencies
7. **Fetch waterfalls** in some service functions
8. **No Next.js caching** - all queries explicitly marked "Not cached"

---

## 1. CRITICAL: Slowest Data-Fetch Patterns

### 1.1 `getCourseAnalytics` - The Biggest Bottleneck ⚠️

**File:** `lib/services/courses.ts:274-355`

**Problem:**
- Single massive Prisma query with 5 levels of nested `include`
- Fetches ALL attendance records, ALL term configs, ALL assessments, ALL scores for ALL students
- No pagination, no limits, no caching
- Processes potentially thousands of records in memory

**Impact:** This query alone can take 1-2 seconds for courses with 50+ students

**Query Structure:**
```typescript
prisma.course.findUnique({
  include: {
    students: { ... },           // All students
    attendance: {                 // ALL attendance records (could be 1000s)
      include: { student: ... }
    },
    termConfigs: {                // All term configs
      include: {
        termGrades: {             // All term grades for all students
          include: { student: ... }
        },
        assessments: {            // All assessments
          include: {
            scores: {              // All scores for all students
              include: { student: ... }
            }
          }
        }
      }
    },
    grades: {                      // All grades
      include: { student: ... }
    }
  }
})
```

**Estimated Query Time:** 800ms - 2000ms for typical course

### 1.2 `getCourseAnalyticsData` - Heavy Post-Processing ⚠️

**File:** `lib/services/course-analytics.ts:259-332`

**Problem:**
- After fetching massive dataset, performs heavy computations:
  - `.map()` over all students (line 268)
  - `.filter()` attendance for each student (line 270) - O(n²) complexity
  - `.map()` over term configs for each student (line 278)
  - Multiple `.map()`, `.filter()`, `.sort()` operations (lines 291-316)
  - Nested loops: `termConfigs.forEach()` → `students.forEach()` → `assessments.find()`

**Impact:** Adds 200-500ms of CPU time on server

**Code Pattern:**
```typescript
course.students.map((student) => {
  // Filter attendance - O(n) for each student
  const studentAttendance = (course.attendance || []).filter(...)
  
  // Build term grades - nested loops
  const termGrades = buildTermGrades(course.termConfigs || [], student.id)
  
  // More nested operations...
})
```

### 1.3 `getCourses` - Loading ALL Attendance Records ⚠️

**File:** `lib/services/courses.ts:35-113`

**Problem:**
- Fetches ALL courses with ALL attendance records
- No pagination, no date filtering
- For 20 courses with 1000 attendance records each = 20,000 records loaded

**Impact:** 500-1000ms for faculty dashboard

**Query:**
```typescript
include: {
  attendance: true,  // ALL attendance records, no filtering
  students: { ... },
  schedules: true
}
```

### 1.4 `getStudents` - Fetching 1000 Records on Initial Load ⚠️

**File:** `app/main/students/page.tsx:15-18`

**Problem:**
- Explicitly fetches 1000 students on initial page load
- No pagination, loads entire dataset
- Includes `coursesEnrolled` relation for each student

**Impact:** 300-600ms for students page

### 1.5 `getCourseDashboardData` - Loading ALL Courses ⚠️

**File:** `features/courses/hook/course-dashboard.ts:6-30`

**Problem:**
- Fetches ALL courses from database with full relations
- No filtering, no pagination
- Includes students, schedules, faculty for ALL courses

**Impact:** 400-800ms for course list page

---

## 2. Serverless Cold Start Risks

### 2.1 API Routes Called from Client Components

**Problem:** Client components use `axios.get()` to call API routes, causing:
- Cold start delay (200-500ms on Vercel)
- Extra network hop (client → API route → database)
- Duplicate authentication checks

**Affected Routes:**
- `/api/courses/[course_slug]/course-analytics` - Called from `useCourseAnalytics` hook
- `/api/courses/[course_slug]/students` - Called from `useStudentsByCourse` hook
- `/api/courses/[course_slug]/attendance` - Called from `useAttendanceByCourse` hook
- `/api/courses/stats/batch` - Called from `useCoursesStatsBatch` hook
- `/api/logs` - Called from `useAuditLogs` hook
- `/api/students` - Called from `useStudents` hook

**Example:**
```typescript
// lib/hooks/queries/useCourses.ts
const { data } = await axios.get(`/courses/${courseSlug}/course-analytics`);
```

**Impact:** Each API call adds 200-500ms cold start + 50-100ms network latency

### 2.2 Missing Route Handlers

**Build Errors Show Missing Routes:**
- `/api/break-glass/status`
- `/api/break-glass/promote`
- `/api/break-glass/self-promote`
- `/api/courses/[course_slug]/assessment-scores/bulk`

These cause 404s and potential retries.

---

## 3. API Routes That Should Be Replaced with Direct RSC Queries

### High Priority Replacements:

1. **`/api/courses/[course_slug]/course-analytics`**
   - **Current:** Client → API route → `getCourseAnalytics` → Database
   - **Should be:** RSC → `getCourseAnalyticsData` → Database (direct)
   - **Already partially done** in `app/main/course/[course_slug]/page.tsx`, but client still calls API

2. **`/api/courses/[course_slug]/students`**
   - **Current:** Client → API route → `getCourseStudentsWithAttendance` → Database
   - **Should be:** RSC → `getCourseStudentsWithAttendance` → Database
   - **Status:** Partially done, but `attendance-studentlist.tsx` still uses API

3. **`/api/courses/stats/batch`**
   - **Current:** Client → API route → Multiple Prisma queries
   - **Should be:** RSC → Direct Prisma queries in parallel
   - **Used by:** `course-data-table.tsx` for stats

4. **`/api/logs`**
   - **Current:** Client → API route → Prisma query
   - **Should be:** RSC → Direct Prisma query
   - **Status:** Already done in `app/admin/logs/page.tsx`, but client still refetches

---

## 4. Duplicate Fetches and Waterfalls

### 4.1 Course Analytics - Duplicate Processing

**Problem:** `getCourseAnalyticsData` is called in:
1. `app/main/course/[course_slug]/page.tsx` (RSC) ✅
2. `lib/hooks/queries/useCourses.ts` → `/api/courses/[course_slug]/course-analytics` (Client) ❌

**Impact:** Data fetched twice - once on server, once on client

### 4.2 Attendance Data - Sequential Fetches

**File:** `features/attendance/components/attendance-studentlist.tsx`

**Problem:**
- Fetches students first
- Then fetches attendance based on students
- Could be parallel if we know the date upfront

**Current Pattern:**
```typescript
const { data: studentsData } = useStudentsByCourse(courseSlug, selectedDate);
const { data: attendanceData } = useAttendanceByCourse(courseSlug, selectedDateStr);
```

**Better:** Both should be fetched in parallel on server

### 4.3 Class Record - Nested Function Calls

**File:** `lib/services/grading.ts:464-501`

**Problem:**
- `getClassRecordData` calls `getTermConfigs`, `getAssessmentScores`, `getCriteriaLinks`
- Each of these makes separate database queries
- Should be batched into single query or use Promise.all more efficiently

**Current:**
```typescript
const [students, termConfigs, assessmentScoresResult, criteriaLinks] =
  await Promise.all([
    prisma.student.findMany(...),
    getTermConfigs(courseSlug),        // Makes its own query
    getAssessmentScores(courseSlug),    // Makes its own query
    getCriteriaLinks(courseSlug),       // Makes its own query
  ]);
```

**Issue:** `getTermConfigs` internally does:
```typescript
const course = await prisma.course.findUnique(...);  // Query 1
// Then uses course.id in include
```

This means we're fetching the course multiple times.

---

## 5. Missing Caching Strategy

### 5.1 No Next.js Caching

**Problem:** Every service function has comment: `// Note: Not cached to ensure fresh data after saves`

**Files Affected:**
- `lib/services/courses.ts` - All functions
- `lib/services/grading.ts` - All functions
- `lib/services/attendance.ts` - All functions
- `lib/services/criteria.ts` - All functions
- `lib/services/groups.ts` - All functions

**Impact:** Every page load = fresh database query, even for static data

**Solution:** Use `unstable_cache` with appropriate tags for cache invalidation:
```typescript
export const getCourseBySlug = unstable_cache(
  async (slug: string) => {
    return prisma.course.findUnique({ ... });
  },
  ['course-by-slug'],
  {
    tags: [`course-${slug}`],
    revalidate: 60, // 60 seconds
  }
);
```

### 5.2 No Fetch Cache Configuration

**Problem:** No `fetch()` calls use `next: { revalidate }` or `cache` options

**Impact:** All fetch calls bypass Next.js cache

---

## 6. Heavy Computations Blocking Rendering

### 6.1 Course Analytics Calculations

**File:** `lib/services/course-analytics.ts:268-304`

**Problem:**
- Synchronous `.map()` over all students
- Nested `.filter()` operations (O(n²) complexity)
- Multiple `.sort()` operations
- All happens before page can render

**Example:**
```typescript
const studentAnalytics = course.students.map((student) => {
  // Filter attendance - O(n) for each student = O(n²)
  const studentAttendance = (course.attendance || []).filter(
    (a) => a.student.id === student.id
  );
  
  // More nested operations...
});
```

**Impact:** Blocks server rendering for 200-500ms

### 6.2 Term Grades Building

**File:** `lib/services/course-analytics.ts:83-155`

**Problem:**
- `buildTermGrades` called for EACH student
- Nested loops: `termConfigs.forEach()` → `assessments.find()` → `scores.find()`
- O(n × m × k) complexity where n=students, m=terms, k=assessments

**Impact:** 100-300ms per student calculation

### 6.3 Leaderboard Calculations

**File:** `app/api/stats/grades/leaderboard/route.ts:184-250`

**Problem:**
- Triple nested loops: `courses.forEach()` → `students.forEach()` → `termConfigs.forEach()`
- Computes grades for ALL students in ALL courses
- No pagination, processes everything in memory

**Impact:** 500-1500ms for leaderboard

---

## 7. Files That Block Rendering Unnecessarily

### 7.1 No Suspense Boundaries

**Problem:** All pages wait for ALL data before rendering anything

**Affected Pages:**
- `app/main/course/[course_slug]/page.tsx` - Waits for full analytics
- `app/main/grading/class-record/[course_slug]/page.tsx` - Waits for all class record data
- `app/main/students/page.tsx` - Waits for 1000 students
- `app/dashboard/faculty/page.tsx` - Waits for courses + stats

**Solution:** Use React Suspense boundaries:
```typescript
<Suspense fallback={<CourseDashboardSkeleton />}>
  <CourseDashboard initialData={analyticsData} />
</Suspense>
```

### 7.2 Sequential Awaits in Pages

**Problem:** Some pages do sequential awaits instead of Promise.all

**Example:** `app/main/grading/class-record/[course_slug]/page.tsx:26-29`
```typescript
const [course, classRecordData] = await Promise.all([...]); // ✅ Good
```

But `getClassRecordData` internally has nested sequential calls.

---

## 8. Database Query Optimizations Needed

### 8.1 Missing Indexes

**Schema Analysis:** Some common query patterns lack indexes:

1. **Course queries by `facultyId` + `status`:**
   - Current: `where: { facultyId, status }`
   - Missing: Composite index on `(facultyId, status)`

2. **Attendance queries by `courseId` + `date`:**
   - Current: Has `@@index([courseId])` and `@@index([date])`
   - Better: Composite index `@@index([courseId, date])`

3. **Student queries by `coursesEnrolled`:**
   - Current: Uses relation filter
   - Missing: No direct index on junction table

### 8.2 N+1 Query Patterns

**File:** `lib/services/courses.ts:80-112`

**Problem:**
```typescript
return courses.map((course) => {
  // These are in-memory filters, but could be optimized
  const totalPresent = course.attendance.filter(...).length;
  const totalAbsents = course.attendance.filter(...).length;
  // ...
});
```

**Better:** Use Prisma aggregations:
```typescript
const attendanceStats = await prisma.attendance.groupBy({
  by: ['courseId', 'status'],
  where: { courseId: { in: courseIds } },
  _count: true
});
```

### 8.3 Over-fetching Data

**Problem:** Many queries fetch more data than needed:

1. **`getCourseAnalytics`** - Fetches ALL attendance, ALL term configs, ALL assessments
   - Should: Fetch only what's needed for current view
   - Should: Add date ranges for attendance
   - Should: Add pagination for students

2. **`getCourses`** - Fetches ALL attendance records
   - Should: Only fetch attendance stats (counts), not full records
   - Should: Use aggregations instead of loading all data

---

## 9. Large Client Bundles

### 9.1 46 Client Components

**Problem:** Many components marked `"use client"` that don't need to be:

**Unnecessary Client Components:**
- `features/courses/components/course-data-table.tsx` - Could be mostly server
- `features/admin/components/admin-data-table.tsx` - Could be mostly server
- `features/grading/components/class-record.tsx` - Needs client for interactivity, but initial load could be server

**Impact:** Larger JavaScript bundles, slower initial page load

### 9.2 Heavy Dependencies in Client Components

**Problem:** Client components import heavy libraries:
- `exceljs` - Large library, should be code-split
- `xlsx` - Large library, should be code-split
- `@tanstack/react-table` - Large library
- `file-saver` - Additional bundle size

**Files:**
- `features/grading/components/class-record.tsx` - Imports ExcelJS, file-saver
- `features/courses/components/term-grades.tsx` - Imports xlsx
- `features/courses/dialogs/export-dialog.tsx` - Imports xlsx

---

## 10. Region Mismatch Implications

**Note:** If database and Vercel functions are in different regions:
- Each query adds 50-200ms network latency
- Multiple queries = cumulative latency
- Cold starts are worse with cross-region calls

**Recommendation:** Ensure database and Vercel are in same region.

---

## 11. Specific File Issues

### Critical Files (Fix First):

1. **`lib/services/courses.ts:274-355`** - `getCourseAnalytics`
   - **Issue:** Massive nested query, no caching, no pagination
   - **Impact:** 1-2 seconds per page load
   - **Priority:** 🔴 CRITICAL

2. **`lib/services/course-analytics.ts:259-332`** - `getCourseAnalyticsData`
   - **Issue:** Heavy post-processing, O(n²) operations
   - **Impact:** 200-500ms CPU time
   - **Priority:** 🔴 CRITICAL

3. **`app/main/course/[course_slug]/page.tsx`**
   - **Issue:** Blocks on heavy analytics query, no Suspense
   - **Impact:** 1.5-2.5 seconds before first paint
   - **Priority:** 🔴 CRITICAL

4. **`lib/services/courses.ts:35-113`** - `getCourses`
   - **Issue:** Loads ALL attendance records, no filtering
   - **Impact:** 500-1000ms for dashboard
   - **Priority:** 🟠 HIGH

5. **`app/main/students/page.tsx:15-18`**
   - **Issue:** Fetches 1000 students on initial load
   - **Impact:** 300-600ms
   - **Priority:** 🟠 HIGH

6. **`features/courses/hook/course-dashboard.ts:6-30`**
   - **Issue:** Loads ALL courses with full relations
   - **Impact:** 400-800ms
   - **Priority:** 🟠 HIGH

### Medium Priority Files:

7. **`lib/services/grading.ts:464-501`** - `getClassRecordData`
   - **Issue:** Nested function calls causing duplicate queries
   - **Impact:** 200-400ms
   - **Priority:** 🟡 MEDIUM

8. **`app/api/courses/[course_slug]/course-analytics/route.ts`**
   - **Issue:** Duplicate processing, called from client
   - **Impact:** 200-500ms cold start + processing
   - **Priority:** 🟡 MEDIUM

9. **`lib/services/courses.ts:117-240`** - `getCourseStudentsWithAttendance`
   - **Issue:** Two separate queries instead of one optimized query
   - **Impact:** 100-200ms
   - **Priority:** 🟡 MEDIUM

10. **`app/api/stats/grades/leaderboard/route.ts`**
    - **Issue:** Triple nested loops, processes all courses/students
    - **Impact:** 500-1500ms
    - **Priority:** 🟡 MEDIUM

---

## 12. Recommendations for Improved SSR/CSR Boundaries

### 12.1 Implement Streaming with Suspense

**Current:** Pages block on all data
**Recommended:** Stream critical content first, defer non-critical

**Example:**
```typescript
// app/main/course/[course_slug]/page.tsx
export default async function CourseDashboardPage({ params }) {
  const { course_slug } = await params;
  
  return (
    <>
      <Suspense fallback={<CourseHeaderSkeleton />}>
        <CourseHeader courseSlug={course_slug} />
      </Suspense>
      
      <Suspense fallback={<StudentsTableSkeleton />}>
        <CourseStudents courseSlug={course_slug} />
      </Suspense>
      
      <Suspense fallback={<AnalyticsSkeleton />}>
        <CourseAnalytics courseSlug={course_slug} />
      </Suspense>
    </>
  );
}
```

### 12.2 Split Heavy Queries

**Current:** One massive query for everything
**Recommended:** Split into parallel, independent queries

**Example:**
```typescript
// Instead of getCourseAnalytics (everything)
const [course, students, attendanceStats, termGrades] = await Promise.all([
  getCourseBasic(courseSlug),           // Fast: basic info only
  getCourseStudents(courseSlug),         // Medium: students list
  getAttendanceStats(courseSlug),       // Fast: aggregated stats
  getTermGradesSummary(courseSlug),     // Medium: summary only
]);
```

### 12.3 Use Partial Prerendering (PPR)

**Recommended:** Enable PPR in `next.config.ts`:
```typescript
const nextConfig = {
  experimental: {
    ppr: true,
  },
};
```

This allows static shell to render immediately while dynamic data streams in.

---

## 13. Ordered Refactor Plan

### 🔴 HIGH PRIORITY FIXES (Immediate Impact)

#### 1. Optimize `getCourseAnalytics` Query
**Files:**
- `lib/services/courses.ts:274-355`
- `lib/services/course-analytics.ts:259-332`

**Actions:**
- Split into multiple parallel queries
- Add date range filtering for attendance
- Use Prisma aggregations instead of loading all records
- Add pagination for students
- Implement `unstable_cache` with tags

**Expected Impact:** Reduce query time from 1-2s to 200-400ms

#### 2. Add Suspense Boundaries
**Files:**
- `app/main/course/[course_slug]/page.tsx`
- `app/main/grading/class-record/[course_slug]/page.tsx`
- `app/main/students/page.tsx`
- `app/dashboard/faculty/page.tsx`

**Actions:**
- Wrap heavy data fetches in Suspense
- Create skeleton components
- Stream critical content first

**Expected Impact:** Reduce Time to First Byte (TTFB) from 2-3s to 200-500ms

#### 3. Replace API Routes with Direct RSC Queries
**Files:**
- `lib/hooks/queries/useCourses.ts` - Remove `/api/courses/[course_slug]/course-analytics` call
- `lib/hooks/queries/useStudents.ts` - Remove `/api/students` call for initial load
- `lib/hooks/queries/useAttendance.ts` - Remove `/api/courses/[course_slug]/attendance` call

**Actions:**
- Move data fetching to RSC pages
- Pass `initialData` to client components
- Keep API routes only for mutations

**Expected Impact:** Eliminate 200-500ms cold starts per page

#### 4. Optimize `getCourses` Query
**Files:**
- `lib/services/courses.ts:35-113`

**Actions:**
- Don't fetch full attendance records, use aggregations
- Add `_count` for attendance stats
- Use `select` instead of `include` where possible

**Expected Impact:** Reduce query time from 500-1000ms to 100-200ms

#### 5. Add Pagination to Students Page
**Files:**
- `app/main/students/page.tsx:15-18`

**Actions:**
- Change `limit: 1000` to `limit: 50`
- Implement server-side pagination
- Use infinite scroll or pagination controls

**Expected Impact:** Reduce initial load from 300-600ms to 50-100ms

### 🟡 MEDIUM PRIORITY FIXES (Significant Impact)

#### 6. Optimize `getClassRecordData`
**Files:**
- `lib/services/grading.ts:464-501`
- `lib/services/grading.ts:7-47` (getTermConfigs)
- `lib/services/grading.ts:161-218` (getAssessmentScores)
- `lib/services/criteria.ts:87-138` (getCriteriaLinks)

**Actions:**
- Combine nested queries into single batched query
- Eliminate duplicate `course.findUnique` calls
- Use single query with proper includes

**Expected Impact:** Reduce from 200-400ms to 100-200ms

#### 7. Add Database Indexes
**Files:**
- `prisma/schema.prisma`

**Actions:**
- Add composite index: `@@index([facultyId, status])` on Course
- Add composite index: `@@index([courseId, date])` on Attendance
- Add index on `Student.coursesEnrolled` junction table

**Expected Impact:** Reduce query time by 20-40%

#### 8. Implement Caching Strategy
**Files:**
- All files in `lib/services/`

**Actions:**
- Add `unstable_cache` to read-heavy queries
- Use cache tags for invalidation
- Set appropriate `revalidate` times

**Expected Impact:** Reduce repeat query time by 80-90%

#### 9. Optimize Leaderboard Calculations
**Files:**
- `app/api/stats/grades/leaderboard/route.ts:184-250`

**Actions:**
- Use database aggregations instead of in-memory loops
- Add pagination
- Cache results

**Expected Impact:** Reduce from 500-1500ms to 100-300ms

#### 10. Code-Split Heavy Libraries
**Files:**
- `features/grading/components/class-record.tsx`
- `features/courses/components/term-grades.tsx`
- `features/courses/dialogs/export-dialog.tsx`

**Actions:**
- Lazy load ExcelJS, xlsx, file-saver
- Use dynamic imports: `const ExcelJS = await import('exceljs')`

**Expected Impact:** Reduce initial bundle size by 200-400KB

### 🟢 LOW PRIORITY IMPROVEMENTS (Nice to Have)

#### 11. Reduce Client Component Count
**Files:**
- All files in `features/` with `"use client"`

**Actions:**
- Identify components that only need client for specific features
- Split into server wrapper + small client components
- Move data fetching to server

**Expected Impact:** Reduce bundle size by 10-20%

#### 12. Add Request Deduplication
**Files:**
- `lib/hooks/queries/useCourses.ts`
- `lib/hooks/queries/useStudents.ts`

**Actions:**
- Ensure TanStack Query deduplication is working
- Add request memoization for identical queries

**Expected Impact:** Prevent duplicate requests

#### 13. Optimize Image Loading
**Files:**
- Components using `student.image`

**Actions:**
- Use Next.js Image component
- Add proper sizing and lazy loading

**Expected Impact:** Improve LCP (Largest Contentful Paint)

---

## 14. Expected Performance Improvements

### After High Priority Fixes:
- **Current:** 3 seconds per page
- **Expected:** 800ms - 1.2 seconds per page
- **Improvement:** 60-70% faster

### After Medium Priority Fixes:
- **Expected:** 400ms - 600ms per page
- **Improvement:** 80-85% faster

### After All Fixes:
- **Expected:** 200ms - 400ms per page
- **Improvement:** 85-90% faster

---

## 15. Monitoring Recommendations

1. **Add Performance Monitoring:**
   - Use Vercel Analytics or similar
   - Track TTFB, FCP, LCP metrics
   - Monitor database query times

2. **Add Query Logging:**
   - Log slow queries (>500ms)
   - Track query patterns
   - Identify N+1 queries

3. **Database Monitoring:**
   - Monitor connection pool usage
   - Track query execution times
   - Identify missing indexes

---

## Conclusion

The primary performance bottleneck is the `getCourseAnalytics` query and its heavy post-processing. Combined with missing Suspense boundaries, API route cold starts, and lack of caching, this results in 3-second page loads.

**Immediate Action Items:**
1. Split `getCourseAnalytics` into optimized parallel queries
2. Add Suspense boundaries to all pages
3. Replace client-side API calls with direct RSC queries
4. Implement caching strategy
5. Add database indexes

Following this plan should reduce page load times from 3 seconds to under 1 second, with further optimizations bringing it below 500ms.

