# Hybrid SSR Refactoring Summary

## Overview

This document summarizes the Hybrid SSR (Server-Side Rendering + TanStack Query) refactoring work completed for Next.js App Router.

## ✅ Completed Refactorings

### 1. Admin Dashboard (`app/dashboard/admin/page.tsx`)

- **Status**: ✅ Completed
- **Changes**:
  - Converted to server component (removed "use client")
  - Fetches users data on server using `getUsers()` from `@/lib/services`
  - Passes `initialUsers` prop to `AdminDashboardStats` component
- **Component Updated**: `features/admin/components/admin-dashboard-stats.tsx`
  - Now accepts `initialUsers` prop
  - Uses `useUsers` hook with `initialData` for client-side updates
  - Disabled `refetchOnMount` and `refetchOnWindowFocus` for initial load
- **Hook Updated**: `lib/hooks/queries/useAdmin.ts`
  - `useUsers` now accepts options object with `initialData`, `refetchOnMount`, `refetchOnWindowFocus`

### 2. Students Page (`app/main/students/page.tsx`)

- **Status**: ✅ Completed
- **Changes**:
  - Converted to server component
  - Fetches students data on server using `getStudents()` from `@/lib/services`
  - Created new client component: `features/students/components/students-page-client.tsx`
  - Passes `initialStudents` prop to client component
- **Component Created**: `features/students/components/students-page-client.tsx`
  - Contains all interactive UI logic
  - Uses `useStudents` hook with `initialData` for client-side updates
  - Uses `useQueryClient` for query invalidation after mutations
- **Hook Updated**: `lib/hooks/queries/useStudents.ts`
  - `useStudents` now accepts options object with `initialData`, `refetchOnMount`, `refetchOnWindowFocus`

### 3. Attendance Page (`app/main/attendance/page.tsx`)

- **Status**: ✅ Completed

### 4. Faculty Dashboard (`app/dashboard/faculty/page.tsx`)

- **Status**: ✅ Completed
- **Changes**:
  - Converted to server component (removed "use client")
  - Fetches courses, faculty stats, and faculty count on server using `getCourses()`, `getFacultyStats()`, and `getFacultyCount()` from `@/lib/services`
  - Passes `initialCourses`, `initialFacultyStats`, and `initialFacultyCount` props to child components
- **Components Updated**:
  - `features/dashboard/components/stats.tsx` - Now accepts `initialFacultyStats`, `initialFacultyCount`, and `userRole` props
  - `features/courses/components/all-courses.tsx` - Now accepts `initialCourses` prop
- **Hooks Updated**: `lib/hooks/queries/useStats.ts`
  - `useFacultyStats` and `useFacultyCount` now accept options object with `initialData`, `refetchOnMount`, `refetchOnWindowFocus`

### 5. Academic Head Dashboard (`app/dashboard/academic-head/page.tsx`)

- **Status**: ✅ Completed
- **Changes**:
  - Converted to server component (removed "use client")
  - Fetches courses, faculty stats, and faculty count on server
  - Uses same components as faculty dashboard with initialData props

### 6. Course Detail Page (`app/main/course/[course_slug]/page.tsx`)

- **Status**: ✅ Completed

### 7. Grading Pages

- **Status**: ✅ Partially Completed (Page-level refactoring done)
- **Pages Completed**:
  - `app/main/grading/class-record/page.tsx` - Converted to server component, fetches courses
  - `app/main/grading/recitation/page.tsx` - Converted to server component, fetches courses
  - `app/main/grading/class-record/[course_slug]/page.tsx` - Converted to server component, fetches course data
  - `app/main/grading/recitation/[course_slug]/page.tsx` - Converted to server component, fetches course data
- **Changes**:
  - All grading index pages now fetch courses on server
  - Course-specific pages fetch course data on server using `getCourseBySlug()`
  - Created `RecitationPageClient` component for interactive UI
  - Note: `GradingTable` and `ClassRecordTable` components still fetch some data client-side (students, grades, criteria) - this is acceptable as these are dynamic/interactive components that need real-time updates
- **Changes**:
  - Converted to server component (removed "use client")
  - Fetches course analytics data on server using `getCourseAnalyticsData()` from `@/lib/services/course-analytics`
  - Created new server-side service: `lib/services/course-analytics.ts` with all calculation logic
  - Passes `initialAnalyticsData` prop to `CourseDashboard` component
- **Component Updated**: `features/courses/components/course-dashboard.tsx`
  - Now accepts `initialAnalyticsData` prop
  - Uses `useCourseAnalytics` hook with `initialData` for client-side updates
  - Disabled `refetchOnMount` and `refetchOnWindowFocus` for initial load
- **Hook Updated**: `lib/hooks/queries/useCourses.ts`
  - `useCourseAnalytics` now accepts options object with `initialData`, `refetchOnMount`, `refetchOnWindowFocus`
- **New Service Created**: `lib/services/course-analytics.ts`
  - Extracted calculation logic from API route for server-side use
  - Includes all helper functions for attendance stats, term grades, and course stats
- **Changes**:
  - Converted to server component (removed "use client")
  - Fetches active courses on server using `getCourses()` from `@/lib/services`
  - Passes `initialCourses` prop to `SemesterCourses` component
- **Component Updated**: `features/courses/components/semester-courses.tsx`
  - Now accepts `initialCourses` prop
  - Uses `useActiveCourses` hook with `initialData` for client-side updates
  - Disabled `refetchOnMount` and `refetchOnWindowFocus` for initial load
- **Hook Updated**: `lib/hooks/queries/useCourses.ts`
  - `useActiveCourses` now accepts options object with `initialData`, `refetchOnMount`, `refetchOnWindowFocus`

## 🔄 Patterns Established

### Server Component Pattern

```typescript
// app/example/page.tsx
import { getData } from "@/lib/services";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { ClientComponent } from "@/features/example/components/client-component";

export default async function ExamplePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }

  const initialData = await getData();

  return <ClientComponent initialData={initialData} />;
}
```

### Client Component Pattern

```typescript
// features/example/components/client-component.tsx
"use client";

import { useData } from "@/lib/hooks/queries";

interface ClientComponentProps {
  initialData: any;
}

export function ClientComponent({ initialData }: ClientComponentProps) {
  const { data } = useData({
    initialData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Component logic...
}
```

### Hook Pattern

```typescript
// lib/hooks/queries/useData.ts
export function useData(options?: {
  filters?: {
    /* ... */
  };
  initialData?: any;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}) {
  const {
    filters,
    initialData,
    refetchOnMount = true,
    refetchOnWindowFocus = true,
  } = options || {};

  return useQuery({
    queryKey: queryKeys.data.list(filters),
    queryFn: async () => {
      // Fetch logic...
    },
    initialData,
    refetchOnMount,
    refetchOnWindowFocus,
  });
}
```

## 📋 Remaining Tasks

### High Priority

1. **Dashboard Pages**

   - ✅ `app/dashboard/faculty/page.tsx` - Completed
   - ✅ `app/dashboard/academic-head/page.tsx` - Completed
   - Components updated:
     - ✅ `features/dashboard/components/stats.tsx` - Completed
     - ✅ `features/courses/components/all-courses.tsx` - Completed
     - ⏳ `features/dashboard/components/weekly-schedule.tsx` - Still needs initialData support (optional, can be done later)

2. **Course Pages**

   - ✅ `app/main/course/[course_slug]/page.tsx` - Completed
   - Component updated:
     - ✅ `features/courses/components/course-dashboard.tsx` - Completed
   - Hook updated:
     - ✅ `lib/hooks/queries/useCourses.ts` - `useCourseAnalytics` - Completed
   - New service created:
     - ✅ `lib/services/course-analytics.ts` - Completed

3. **Grading Pages**

   - ✅ `app/main/grading/class-record/page.tsx` - Completed
   - ✅ `app/main/grading/recitation/page.tsx` - Completed
   - ✅ `app/main/grading/class-record/[course_slug]/page.tsx` - Completed (fetches course data)
   - ✅ `app/main/grading/recitation/[course_slug]/page.tsx` - Completed (fetches course data)
   - ⏳ `app/main/grading/reporting/page.tsx` - Needs courses data (similar to above)
   - ⏳ `app/main/grading/reporting/[course_slug]/page.tsx` - Needs reporting data
   - ⏳ `app/main/grading/reporting/[course_slug]/individual/page.tsx` - Needs individual reporting data
   - ⏳ `app/main/grading/reporting/[course_slug]/group/[group_id]/page.tsx` - Needs group reporting data
   - Components to update (optional - complex refactoring):
     - `features/grading/components/grading-table.tsx` - Still fetches some data, but course data is now from server
     - `features/grading/components/class-record.tsx` - Still fetches some data, but course data is now from server
   - Hooks to update (optional):
     - `lib/hooks/queries/useGrading.ts` - Can be updated to support initialData if needed
     - `lib/hooks/queries/useReporting.ts` - Can be updated to support initialData if needed

4. **Admin Pages**
   - `app/admin/logs/page.tsx` - Needs audit logs data
   - Component to update:
     - `features/admin/components/AuditLogsTable.tsx`
   - Hook to update:
     - `lib/hooks/queries/useAuditLogs.ts`

### Medium Priority

5. **Other Pages**

   - `app/main/faculty-load/page.tsx` - Needs faculty load data
   - `app/main/logs/page.tsx` - Needs logs data
   - `app/main/attendance/class/[course_slug]/page.tsx` - Needs attendance data

6. **Component Cleanup**
   - Remove all data fetching from child components
   - Make all child components pure UI components that only accept props
   - Ensure no child component uses `useQuery` or `useQueries` for initial data

## 🔍 Key Files to Review

### Server-Side Services (Already Available)

- `lib/services/users.ts` - `getUsers()`
- `lib/services/students.ts` - `getStudents()`
- `lib/services/courses.ts` - `getCourses()`, `getCourseBySlug()`, `getCourseAnalytics()`
- `lib/services/attendance.ts` - `getAttendance()`
- `lib/services/grading.ts` - Various grading functions
- `lib/services/stats.ts` - Stats functions

### Hooks That Need Updates

- `lib/hooks/queries/useCourses.ts` - ✅ `useActiveCourses` updated, others pending
- `lib/hooks/queries/useStats.ts` - ✅ `useFacultyStats` and `useFacultyCount` updated
- `lib/hooks/queries/useGrading.ts` - All hooks need `initialData` support
- `lib/hooks/queries/useReporting.ts` - All hooks need `initialData` support
- `lib/hooks/queries/useAuditLogs.ts` - All hooks need `initialData` support
- `lib/hooks/queries/useStats.ts` - All hooks need `initialData` support
- `lib/hooks/queries/useFacultyLoad.ts` - Needs `initialData` support

## 📝 Notes

1. **Session Handling**: All server components should check for session and redirect if not authenticated
2. **Error Handling**: Server components should handle errors gracefully
3. **Type Safety**: Ensure proper TypeScript types for all `initialData` props
4. **Query Invalidation**: Client components should use `useQueryClient` to invalidate queries after mutations
5. **Performance**: Initial data should be fetched efficiently on the server, avoiding unnecessary API calls

## 🎯 Next Steps

1. Continue refactoring dashboard pages (faculty, academic-head)
2. Refactor course detail page and course dashboard component
3. Refactor all grading pages systematically
4. Refactor admin logs page
5. Clean up all child components to remove data fetching
6. Run full type check and fix any errors
7. Test all pages to ensure SSR is working correctly
