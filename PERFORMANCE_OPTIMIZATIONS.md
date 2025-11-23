# 🚀 Performance Optimization Plan

## 🔴 CRITICAL (Immediate Impact)

### 1. Enable Link Prefetching

**Files:** All `Link` components
**Impact:** 50-70% faster navigation

```typescript
// Current: No prefetch specified
<Link href={item.url}>

// Optimized: Enable prefetch (default in Next.js, but ensure it's not disabled)
<Link href={item.url} prefetch={true}>
```

### 2. Optimize Next.js Config

**File:** `next.config.ts`
**Impact:** 20-30% smaller bundles, faster builds

```typescript
const nextConfig: NextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Add these optimizations:
  compress: true,
  poweredByHeader: false,

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enable SWC minification
  swcMinify: true,

  // Optimize production builds
  productionBrowserSourceMaps: false,
};
```

### 3. Lazy Load Heavy Libraries

**Files:**

- `features/grading/components/class-record.tsx` (ExcelJS)
- `features/courses/dialogs/export-dialog.tsx` (xlsx, file-saver)
- `features/courses/components/term-grades.tsx` (ExcelJS)

**Impact:** Reduce initial bundle by 200-400KB

```typescript
// Instead of:
import ExcelJS from "exceljs";

// Use:
const handleExport = async () => {
  const ExcelJS = (await import("exceljs")).default;
  // ... use ExcelJS
};
```

### 4. Add More Suspense Boundaries

**Files:**

- `app/main/course/[course_slug]/page.tsx`
- `app/main/grading/class-record/[course_slug]/page.tsx`
- `app/main/students/page.tsx`

**Impact:** 40-60% faster Time to First Contentful Paint

```typescript
<Suspense fallback={<CourseHeaderSkeleton />}>
  <CourseHeader courseSlug={course_slug} />
</Suspense>

<Suspense fallback={<StudentsTableSkeleton />}>
  <CourseStudents courseSlug={course_slug} />
</Suspense>
```

## 🟠 HIGH PRIORITY (Significant Impact)

### 5. Optimize React Query Cache

**File:** `providers/query-provider.tsx`
**Impact:** 30-50% fewer unnecessary refetches

```typescript
defaultOptions: {
  queries: {
    staleTime: 5 * 60 * 1000, // Keep current
    gcTime: 10 * 60 * 1000, // Keep current
    refetchOnWindowFocus: false, // Keep current
    retry: 1, // Keep current

    // Add these:
    refetchOnMount: false, // Don't refetch if data exists
    refetchOnReconnect: false, // Don't refetch on reconnect
  },
}
```

### 6. Memoize Expensive Computations

**Files:** Components with heavy `.map()`, `.filter()`, `.sort()` operations
**Impact:** 20-40% faster re-renders

Already using `useMemo` in many places (108 instances found), but ensure:

- All filtered/sorted arrays are memoized
- All derived data is memoized
- Expensive calculations use `useMemo`

### 7. Replace Regular Images with Next.js Image

**Files:** Any component using `<img>` tags
**Impact:** 30-50% faster image loading, better LCP

Search for: `<img` or `img src`
Replace with: `<Image from next/image>`

### 8. Add Prefetching on Hover

**File:** `shared/components/layout/app-sidebar.tsx`
**Impact:** Instant navigation on click

```typescript
<Link
  href={item.url}
  onMouseEnter={() => {
    router.prefetch(item.url);
  }}
>
```

## 🟡 MEDIUM PRIORITY (Good Impact)

### 9. Virtual Scrolling for Large Lists

**Files:**

- `features/courses/components/course-data-table.tsx`
- `features/students/components/students-page-client.tsx`
- `features/admin/components/admin-data-table.tsx`

**Impact:** Smooth scrolling with 1000+ items

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

// Use virtual scrolling for large lists
```

### 10. Database Query Optimization

**Files:** `lib/services/*.ts`
**Impact:** 20-40% faster queries

Based on PERFORMANCE_ANALYSIS_REPORT.md:

- Add database indexes
- Use Prisma aggregations instead of loading all records
- Implement `unstable_cache` for read-heavy queries

### 11. Code Splitting by Route

**Impact:** 15-25% smaller initial bundle

Already using Next.js App Router (automatic code splitting), but ensure:

- Heavy components are lazy loaded
- Modals/dialogs are lazy loaded

### 12. Optimize Bundle Size

**Impact:** Faster initial load

Check for:

- Unused imports
- Duplicate dependencies
- Large dependencies that could be replaced

Run: `npm run build` and check bundle analyzer

## 🟢 LOW PRIORITY (Nice to Have)

### 13. Service Worker for Offline Support

**Impact:** Instant repeat visits

### 14. HTTP/2 Server Push

**Impact:** Faster resource loading

### 15. CDN for Static Assets

**Impact:** Faster global access

## 📊 Expected Overall Impact

After implementing CRITICAL + HIGH priority:

- **Initial Load:** 40-60% faster
- **Navigation:** 50-70% faster
- **Re-renders:** 20-40% faster
- **Bundle Size:** 15-25% smaller

## 🎯 Quick Wins (Do These First)

1. ✅ Enable Link prefetching (5 min)
2. ✅ Optimize next.config.ts (10 min)
3. ✅ Lazy load ExcelJS (15 min)
4. ✅ Add Suspense boundaries (30 min)
5. ✅ Optimize React Query config (5 min)

Total time: ~1 hour for significant performance gains!
