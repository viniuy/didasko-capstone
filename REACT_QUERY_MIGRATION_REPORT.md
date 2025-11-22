# React Query Migration Report

## Summary

This report identifies all fetch/axios calls in the codebase that need to be migrated to React Query hooks.

## ✅ Already Covered by React Query Hooks

All major entities are covered:

- ✅ Courses (useCourses.ts)
- ✅ Students (useStudents.ts)
- ✅ Attendance (useAttendance.ts)
- ✅ Grading (useGrading.ts)
- ✅ Groups (useGroups.ts)
- ✅ Reporting (useReporting.ts)
- ✅ Criteria (useCriteria.ts)
- ✅ Admin/Users (useAdmin.ts)
- ✅ Audit Logs (useAuditLogs.ts)
- ✅ Stats (useStats.ts)
- ✅ Notes (useNotes.ts)
- ✅ Events (useEvents.ts)
- ✅ Profile (useProfile.ts)
- ✅ Faculty Load (useFacultyLoad.ts)

## 🔴 Components Using Direct Fetch/Axios (Need Migration)

### 1. **Audit Logs Table** (`features/admin/components/AuditLogsTable.tsx`)

- **Lines 236, 303, 558**: Direct `fetch()` calls
- **Endpoints**: `/api/logs`, `/api/users/faculty`, `/api/logs/export`
- **Status**: Should use `useAuditLogs()` and `useFaculty()` hooks
- **Action**: Replace with React Query hooks

### 2. **Break Glass Components** (Multiple files)

- **Files**:
  - `features/admin/components/break-glass-compact.tsx`
  - `features/admin/components/break-glass-widget.tsx`
  - `features/admin/components/admin-data-table.tsx`
- **Endpoints**: `/api/break-glass/status`, `/api/break-glass/activate`, `/api/break-glass/deactivate`, `/api/break-glass/promote`
- **Status**: Partially covered in `useAdmin.ts` but components use direct fetch
- **Action**: Use `useBreakGlassStatus()`, `useActivateBreakGlass()`, `useDeactivateBreakGlass()`, `usePromoteUser()` hooks

### 3. **Profile Edit Modal** (`shared/components/profile/components/EditProfileModal.tsx`)

- **Lines 79, 87, 120, 128**: Direct `fetch()` calls
- **Endpoints**: `/api/upload`, `/api/profile`
- **Status**: Should use `useUpdateProfile()` hook + new upload hook
- **Action**: Create `useUpload()` hook and use `useUpdateProfile()`

### 4. **Groups Components**

- **Files**:
  - `features/groups/components/add-group-modal.tsx` (line 157)
  - `features/groups/components/group-card.tsx` (line 41)
  - `features/groups/components/randomizer-button.tsx` (line 127)
- **Endpoints**: `/api/courses/${courseCode}/groups`
- **Status**: Should use `useCreateGroup()` hook
- **Action**: Replace with `useCreateGroup()` mutation

### 5. **Notes Component** (`features/dashboard/components/notes.tsx`)

- **Lines 136, 288**: Direct `axiosInstance` calls
- **Endpoints**: `/api/notes`, `/api/notes/${id}`
- **Status**: Should use `useNotes()`, `useDeleteNote()` hooks
- **Action**: Replace with React Query hooks

### 6. **Import Students Dialog** (`features/courses/dialogs/import-students-dialog.tsx`)

- **Line 143**: Direct `fetch()` call
- **Endpoint**: `/api/courses/${courseSlug}/students/import`
- **Status**: Should use `useImportStudentsToCourse()` hook
- **Action**: Replace with mutation hook

### 7. **Faculty List** (`features/faculty/components/faculty-list.tsx`)

- **Line 71**: Direct `fetch()` call
- **Endpoint**: `/api/users/faculty`
- **Status**: Should use `useFaculty()` hook
- **Action**: Replace with React Query hook

### 8. **Header Component** (`shared/components/layout/header.tsx`)

- **Lines 33, 72**: Direct `fetch()` calls
- **Endpoints**: `/api/break-glass/status`, `/api/break-glass/self-promote`
- **Status**: Should use `useBreakGlassStatus()` hook + new self-promote hook
- **Action**: Add `useSelfPromote()` hook if needed

### 9. **App Sidebar** (`shared/components/layout/app-sidebar.tsx`)

- **Lines 177, 280, 292**: Direct `fetch()` calls
- **Endpoints**: Image HEAD check, `/api/auth/logout`, `/api/auth/session`
- **Status**: Auth endpoints may not need React Query (session management)
- **Action**: Keep auth calls as-is or create minimal hooks

### 10. **Redirecting Page** (`app/redirecting/page.tsx`)

- **Line 33**: Direct `fetch()` call
- **Status**: Likely one-time redirect logic
- **Action**: May not need React Query

## 🔴 Client Service Files (Can Be Deprecated)

These service files wrap axios calls and should be replaced by React Query hooks:

### 1. **`lib/services/client/courses.ts`**

- **Status**: All methods covered by `useCourses.ts` hooks
- **Action**: Mark as deprecated, migrate components to use hooks

### 2. **`lib/services/client/students.ts`**

- **Status**: All methods covered by `useStudents.ts` hooks
- **Action**: Mark as deprecated, migrate components to use hooks

### 3. **`lib/services/client/groups.ts`**

- **Status**: All methods covered by `useGroups.ts` hooks
- **Action**: Mark as deprecated, migrate components to use hooks

### 4. **`lib/services/client/grading.ts`**

- **Status**: Should check if covered by `useGrading.ts`
- **Action**: Review and migrate

### 5. **`lib/services/client/criteria.ts`**

- **Status**: Should check if covered by `useCriteria.ts`
- **Action**: Review and migrate

### 6. **`lib/services/client/users.ts`**

- **Status**: Should check if covered by `useAdmin.ts`
- **Action**: Review and migrate

### 7. **`lib/services/client/stats.ts`**

- **Status**: Should check if covered by `useStats.ts`
- **Action**: Review and migrate

## 🟡 Additional Hooks Needed

### 1. **Upload Hook** (`useUpload.ts`)

```typescript
// For file uploads (images, documents)
export function useUpload() {
  // Upload file mutation
}
```

### 2. **Self-Promote Hook** (if needed)

```typescript
// For break-glass self-promotion
export function useSelfPromote() {
  // Self-promote mutation
}
```

### 3. **Dashboard Stats Hook** (if not covered)

```typescript
// For dashboard-specific aggregated stats
export function useDashboardStats() {
  // Multiple stats queries
}
```

## 📊 Components Using Service Wrappers (Need Migration)

These components use service wrappers that should be replaced with React Query hooks:

1. **`features/courses/components/course-data-table.tsx`**

   - Uses: `coursesService.getStats()`, `coursesService.getCourses()`
   - Replace with: `useCourseStats()`, `useCourses()`

2. **`features/courses/components/course-dashboard.tsx`**

   - Uses: `coursesService.getAnalytics()`, `studentsService.importToCourse()`
   - Replace with: `useCourseAnalytics()`, `useImportStudentsToCourse()`

3. **`features/right-sidebar/components/course-analytics.tsx`**

   - Uses: `coursesService.getAnalytics()`
   - Replace with: `useCourseAnalytics()`

4. **`features/right-sidebar/components/my-subjects.tsx`**

   - Uses: `coursesService.getActiveCourses()`
   - Replace with: `useActiveCourses()`

5. **`features/courses/sheets/add-student-sheet.tsx`**

   - Uses: `studentsService.getStudents()`
   - Replace with: `useStudents()`

6. **`features/grading/components/grading-table.tsx`**
   - Uses: `groupsService.getGroupStudents()`, `coursesService.getStudents()`
   - Replace with: `useGroupStudents()`, `useCourseStudents()`

## 🔍 Components Using Direct Axios (Need Migration)

1. **`features/attendance/components/attendance-studentlist.tsx`**

   - Multiple `axiosInstance` calls
   - Should use: `useCourseStudents()`, `useRecordAttendance()`, `useCreateStudent()`, etc.

2. **`features/grading/components/grading-table.tsx`**

   - Multiple `axiosInstance` calls
   - Should use: `useClassRecord()`, `useTermConfigs()`, `useBulkUpdateAssessmentScores()`, etc.

3. **`features/courses/components/semester-courses.tsx`**

   - Uses: `axiosInstance.get("/courses/active")`
   - Should use: `useActiveCourses()`

4. **`features/courses/components/all-courses.tsx`**

   - Uses: `axiosInstance.get("/courses/active")`
   - Should use: `useActiveCourses()`

5. **`features/dashboard/components/weekly-schedule.tsx`**

   - Uses: `axiosInstance.get("/courses/schedules")`
   - Should use: New hook or existing course schedules hook

6. **`features/right-sidebar/components/active-faculty.tsx`**

   - Uses: `axiosInstance.get("/users/online")`
   - Should use: `useOnlineUsers()`

7. **`features/right-sidebar/components/user-id-search.tsx`**

   - Uses: `axiosInstance.get("/users")`
   - Should use: `useUsers()`

8. **`features/admin/components/admin-data-table.tsx`**

   - Uses: `axiosInstance.get("/users")`, `axiosInstance.post("/users/import")`
   - Should use: `useUsers()`, `useImportUsers()`

9. **`features/attendance/components/attendance-ranks.tsx`**

   - Uses: `axiosInstance.get("/courses/attendance-ranking")`
   - Should use: `useAttendanceRanking()`

10. **`features/attendance/components/attendance-schedule.tsx`**

    - Uses: `axiosInstance.get("/courses/schedules")`
    - Should use: New hook or existing course schedules hook

11. **`features/courses/hook/dashboard-data.ts`**
    - Multiple `axiosInstance` calls for dashboard stats
    - Should use: `useStats()` hooks or create `useDashboardStats()`

## ✅ Migration Priority

### High Priority (Most Used)

1. ✅ Audit Logs Table
2. ✅ Break Glass Components
3. ✅ Notes Component
4. ✅ Groups Components
5. ✅ Profile Edit Modal

### Medium Priority

1. ✅ Components using service wrappers
2. ✅ Attendance components
3. ✅ Grading components
4. ✅ Course components

### Low Priority

1. ✅ Auth-related calls (may not need React Query)
2. ✅ One-time redirect logic
3. ✅ Image HEAD checks

## 📝 Recommendations

1. **Create `useUpload.ts` hook** for file uploads
2. **Deprecate client service files** - mark them as deprecated and add migration comments
3. **Create migration guide** for developers
4. **Update components gradually** - start with high-priority components
5. **Add TypeScript types** for all hook responses
6. **Consider prefetching** for common navigation patterns

## 🎯 Next Steps

1. Create missing hooks (`useUpload.ts`)
2. Start migrating high-priority components
3. Update service files with deprecation notices
4. Create migration examples for common patterns
5. Update documentation
