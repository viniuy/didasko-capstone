# 🚀 Speed Optimizations for `/main/course` (5+ seconds → <1 second)

## 🔴 CRITICAL Issues Found

### 1. **Blocking Server-Side Data Fetch** (5+ seconds)

**File:** `app/main/course/page.tsx`
**Problem:** `getCourseDashboardData()` blocks entire page render
**Impact:** 5177ms wait time

**Solution:** Use Suspense + Client-Side Fetching

```typescript
// Instead of blocking:
const { courses } = await getCourseDashboardData();

// Use Suspense boundary:
export default async function CourseDashboardPage() {
  return (
    <div>
      <Header />
      <AppSidebar />
      <main>
        <Suspense fallback={<CourseTableSkeleton />}>
          <CourseDataTableWrapper userRole={userRole} userId={userId} />
        </Suspense>
        <Rightsidebar />
      </main>
    </div>
  );
}

// Move to client component:
("use client");
function CourseDataTableWrapper({ userRole, userId }) {
  const { data: courses } = useActiveCourses({
    filters: { facultyId: userId },
    refetchOnMount: false,
  });

  return (
    <CourseDataTable courses={courses} userRole={userRole} userId={userId} />
  );
}
```

### 2. **API Route Cold Start** (1.7 seconds)

**File:** `app/api/courses/stats/batch/route.ts`
**Problem:** Route compiles on first request (3785 modules!)
**Impact:** 1727ms compilation delay

**Solutions:**

#### Option A: Pre-compile Route (Recommended)

```typescript
// Add to route.ts
export const dynamic = "force-dynamic"; // Or 'auto'
export const runtime = "nodejs"; // Explicit runtime
```

#### Option B: Cache API Response

```typescript
export async function POST(req: NextRequest) {
  // Add caching headers
  const response = NextResponse.json(data);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  );
  return response;
}
```

#### Option C: Move to Server Action (Best for Next.js 14+)

```typescript
// app/actions/courses.ts
"use server";
export async function getCoursesStatsBatch(courseSlugs: string[]) {
  // ... same logic
}

// In component:
import { getCoursesStatsBatch } from "@/app/actions/courses";
const stats = await getCoursesStatsBatch(courseSlugs);
```

### 3. **Heavy Database Query**

**File:** `features/courses/hook/course-dashboard.ts`
**Problem:** Likely fetching all courses with full relations

**Solution:** Optimize Query

```typescript
// Only fetch what's needed for initial render
const courses = await prisma.course.findMany({
  where: { facultyId, status: "ACTIVE" },
  select: {
    id: true,
    code: true,
    title: true,
    section: true,
    slug: true,
    // Don't include heavy relations initially
    _count: {
      select: {
        students: true,
        attendance: true,
      },
    },
  },
  take: 50, // Paginate
});
```

## 🟠 HIGH PRIORITY Optimizations

### 4. **Add Route Segment Config**

**File:** `app/main/course/page.tsx`

```typescript
// Add at top of file
export const dynamic = "force-dynamic";
export const revalidate = 60; // ISR: revalidate every 60s
// OR for static:
export const revalidate = 3600; // Revalidate hourly
```

### 5. **Split Data Fetching**

**Current:** Fetch everything server-side
**Better:**

- Load basic course list immediately (fast)
- Load stats in parallel client-side (non-blocking)

```typescript
// Server: Only basic course list
const courses = await getCourses({ facultyId, status: "ACTIVE" });

// Client: Fetch stats in parallel
const { data: stats } = useCoursesStatsBatch(courseSlugs, {
  enabled: !!courseSlugs.length,
});
```

### 6. **Use React Query with Initial Data**

**Already partially implemented, but optimize:**

```typescript
// In page.tsx - fetch minimal data
const courses = await getCourses({ facultyId, status: "ACTIVE" });

// Pass as initialData to client component
<CourseDataTable
  courses={courses}
  initialStats={undefined} // Load client-side
  userRole={userRole}
  userId={userId}
/>;
```

## 🟡 MEDIUM PRIORITY

### 7. **Database Indexes**

**File:** `prisma/schema.prisma`

```prisma
model Course {
  // Add indexes
  @@index([facultyId, status])
  @@index([slug])
  @@index([status])
}
```

### 8. **Implement Caching**

**File:** `features/courses/hook/course-dashboard.ts`

```typescript
import { unstable_cache } from "next/cache";

export async function getCourseDashboardData() {
  return unstable_cache(
    async () => {
      // ... fetch logic
    },
    ["course-dashboard"],
    {
      tags: ["courses"],
      revalidate: 60, // Cache for 60 seconds
    }
  )();
}
```

### 9. **Remove Console Logs in Production**

**File:** `app/main/course/page.tsx`

```typescript
// Remove these (they slow down server):
console.log("UserID: ", userId);
console.log("userRole: ", userRole);
console.log("Full session: ", session);
```

## 📊 Expected Impact

**Before:**

- Page load: 5177ms
- API compile: 1727ms
- **Total: ~7 seconds**

**After (with all optimizations):**

- Page load: 200-400ms (with Suspense)
- API compile: 0ms (pre-compiled or cached)
- **Total: <1 second** ⚡

## 🎯 Quick Wins (Do First)

1. ✅ Add Suspense boundary (5 min) - **Biggest impact**
2. ✅ Remove console.logs (1 min)
3. ✅ Add route segment config (2 min)
4. ✅ Move stats to client-side (10 min)
5. ✅ Add API caching (5 min)

**Total time: ~25 minutes for 80% improvement!**
