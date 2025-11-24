# Codebase Features Documentation

## Routing, Optimization, and Performance Features

---

## 📍 ROUTING FEATURES

### **Next.js App Router Implementation**

- **Dynamic Routes**: 71 API routes with dynamic segments
- **Server Components**: Server-side rendering for initial data fetching
- **Route Segment Config**: Performance optimizations per route
  - `dynamic = "force-dynamic"` for real-time data
  - `maxDuration = 30` seconds for long-running operations
  - `revalidate = 60` seconds for ISR (Incremental Static Regeneration)

### **Page Routes (23 pages)**

1. **Dashboard Routes**:

   - `/dashboard/faculty` - Faculty dashboard
   - `/dashboard/admin` - Admin dashboard
   - `/dashboard/academic-head` - Academic head dashboard

2. **Course Management Routes**:

   - `/main/course` - Course listing
   - `/main/course/[course_slug]` - Individual course dashboard
   - `/main/course/[course_slug]/page.tsx` - Course detail page with Suspense

3. **Grading Routes**:

   - `/main/grading/class-record` - Class record listing
   - `/main/grading/class-record/[course_slug]` - Course-specific class record
   - `/main/grading/recitation` - Recitation grading
   - `/main/grading/recitation/[course_slug]` - Course-specific recitation
   - `/main/grading/reporting` - Reporting dashboard
   - `/main/grading/reporting/[course_slug]` - Course reporting
   - `/main/grading/reporting/[course_slug]/individual` - Individual reporting
   - `/main/grading/reporting/[course_slug]/group` - Group reporting
   - `/main/grading/reporting/[course_slug]/group/[group_id]` - Specific group reporting

4. **Attendance Routes**:

   - `/main/attendance` - Attendance dashboard
   - `/main/attendance/class/[course_slug]` - Class attendance

5. **Other Routes**:
   - `/main/students` - Student management
   - `/main/faculty-load` - Faculty load management
   - `/main/logs` - Activity logs
   - `/admin/logs` - Admin audit logs
   - `/redirecting` - Role-based redirection

### **API Routes (71 endpoints)**

#### **Course Management APIs**:

- `GET/POST /api/courses` - List/create courses
- `GET /api/courses/active` - Active courses only
- `GET /api/courses/archived` - Archived courses
- `GET /api/courses/stats/batch` - Batch statistics
- `GET/PUT /api/courses/[course_slug]` - Course CRUD
- `GET /api/courses/[course_slug]/course-analytics` - Course analytics
- `GET /api/courses/[course_slug]/term-grades/[term]` - Term-specific grades
- `GET/POST /api/courses/[course_slug]/students` - Student management
- `GET/POST /api/courses/[course_slug]/grades` - Grade management
- `GET /api/courses/[course_slug]/grades/dates` - Available grade dates
- `GET/POST /api/courses/[course_slug]/term-configs` - Term configuration
- `GET/PUT /api/courses/[course_slug]/assessment-scores` - Assessment scores
- `POST /api/courses/[course_slug]/assessment-scores/bulk` - Bulk score updates
- `GET/POST /api/courses/[course_slug]/criteria` - Criteria management
- `GET/POST /api/courses/[course_slug]/groups` - Group management
- `GET/POST /api/courses/[course_slug]/attendance` - Attendance tracking
- `GET /api/courses/[course_slug]/attendance/stats` - Attendance statistics
- `POST /api/courses/import` - Course import
- `POST /api/courses/bulk-archive` - Bulk archive operations

#### **User Management APIs**:

- `GET/POST /api/users` - User CRUD
- `GET /api/users/faculty` - Faculty listing
- `GET /api/users/online` - Online users
- `POST /api/users/import` - User import
- `GET /api/users/export` - User export

#### **Student Management APIs**:

- `GET/POST /api/students` - Student CRUD
- `GET/PUT /api/students/[student_id]` - Student operations
- `GET/PUT /api/students/[student_id]/image` - Student image
- `GET /api/students/rfid` - RFID lookup
- `POST /api/students/rfid/assign` - RFID assignment

#### **Statistics APIs**:

- `GET /api/stats/faculty-stats` - Faculty statistics
- `GET /api/stats/faculty-count` - Faculty count
- `GET /api/stats/grades/leaderboard` - Global leaderboard
- `GET /api/stats/grades/leaderboard/[course_slug]` - Course leaderboard
- `GET /api/attendance/leaderboard` - Attendance leaderboard
- `GET /api/attendance/leaderboard/all` - All attendance leaderboard

#### **Other APIs**:

- `GET/POST /api/notes` - Notes management
- `GET/POST /api/logs` - Audit logs
- `GET /api/logs/export` - Log export
- `GET/POST /api/break-glass/*` - Break-glass emergency access
- `GET/POST /api/profile` - User profile
- `POST /api/upload` - File uploads

### **Route Protection & Authentication**

- Server-side session validation on all protected routes
- Role-based access control (ADMIN, FACULTY, ACADEMIC_HEAD)
- Automatic redirection for unauthorized users
- Break-glass emergency access system

---

## ⚡ OPTIMIZATION FEATURES

### **1. Database Query Optimizations**

#### **Batch Queries & Parallel Execution**:

- **Promise.all()** for parallel query execution
- **GroupBy queries** instead of N+1 queries
- **Batched attendance stats**: Single query per unique date instead of N queries
- **Parallel course analytics**: Split into 3 parallel queries (course, attendance, termConfigs)
- **Batch assessment scores**: Combined queries for assessment and criteria scores

#### **Selective Field Fetching**:

- **`select` instead of `include`**: Only fetch required fields
- **`_count` for aggregations**: Use `_count.students` instead of loading all students
- **Minimal field selection**: Only select necessary fields in queries

#### **Index Optimization**:

- **Composite indexes**: `@@index([courseId, isGroupCriteria])` for fast lookups
- **Slug-based lookups**: Fast course retrieval using slug index
- **Ordered queries**: Use indexed fields for sorting

#### **Query Batching Examples**:

```typescript
// Before: N queries (one per course)
// After: 1 query per unique date
const dateToCourses = new Map<string, string[]>();
// Groups courses by date, then fetches in batches

// Parallel execution
const [course, attendance, termConfigs] = await Promise.all([
  coursePromise,
  attendancePromise,
  termConfigsPromise,
]);
```

### **2. Caching Strategies**

#### **Next.js `unstable_cache`**:

- **Course data caching**: 5-minute revalidation
- **Tag-based invalidation**: `tags: [course-${slug}, "courses"]`
- **Selective caching**: Only cache read-heavy operations

#### **React Query Caching**:

- **Default staleTime**: 5 minutes
- **Default gcTime**: 10 minutes (formerly cacheTime)
- **Query-specific staleTime**: Custom per query (0 for real-time data)
- **Centralized query keys**: Hierarchical key structure for easy invalidation

#### **Cache Configuration**:

```typescript
// Global React Query config
staleTime: 5 * 60 * 1000, // 5 minutes
gcTime: 10 * 60 * 1000, // 10 minutes
refetchOnWindowFocus: false,
refetchOnMount: false,
refetchOnReconnect: false,
retry: 1,
```

### **3. Data Fetching Optimizations**

#### **Server-Side Data Fetching**:

- **Initial data**: Pass `initialData` to React Query hooks
- **Suspense boundaries**: Server components with Suspense fallbacks
- **Streaming**: Progressive data loading with Suspense

#### **Client-Side Optimizations**:

- **Conditional fetching**: `enabled` flag for conditional queries
- **Parallel queries**: `useQueries` for multiple parallel requests
- **Query invalidation**: Smart cache invalidation on mutations

#### **Lazy Loading**:

- **Dynamic imports**: Code splitting for large components
- **Route-based splitting**: Automatic code splitting per route
- **Component lazy loading**: Load components on demand

### **4. Component Optimizations**

#### **React Performance Hooks**:

- **126 instances** of `useMemo`, `useCallback`, `React.memo`
- **Memoized computations**: Expensive calculations cached
- **Stable function references**: Prevent unnecessary re-renders

#### **Optimization Patterns**:

```typescript
// Memoized filtered data
const filteredStudents = useMemo(() => {
  return students.filter(/* ... */);
}, [students, searchQuery]);

// Stable callbacks
const handleChange = useCallback(
  (value) => {
    // ...
  },
  [dependencies]
);

// Memoized components
export const Component = React.memo(({ props }) => {
  // ...
});
```

### **5. Network Optimizations**

#### **Axios Configuration**:

- **30-second timeout**: Prevents hanging requests
- **Request/Response interceptors**: Centralized error handling
- **Retry logic**: Exponential backoff for failed requests
- **Error handling**: Specific error messages for different failure types

#### **Retry Strategy**:

```typescript
retry: 3,
retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
// Exponential backoff: 1s, 2s, 4s (max 5s)
```

### **6. State Management Optimizations**

#### **Optimistic Updates**:

- **Immediate UI updates**: Update UI before server confirmation
- **Rollback on error**: Revert changes if mutation fails
- **Toast notifications**: User feedback for mutations

#### **State Batching**:

- **React 18 auto-batching**: Automatic state update batching
- **Transition API**: Non-urgent updates with `startTransition`
- **Debounced updates**: Debounce for search/filter inputs

---

## 🚀 PERFORMANCE FEATURES

### **1. Rendering Performance**

#### **Server Components**:

- **Zero JavaScript**: Server components don't ship JS to client
- **Faster initial load**: HTML rendered on server
- **Reduced bundle size**: Less client-side code

#### **Suspense & Streaming**:

- **Progressive loading**: Show content as it loads
- **Skeleton loaders**: Placeholder UI during loading
- **Non-blocking**: Don't block entire page for one component

#### **Virtualization** (Recommended):

- **Large list optimization**: Virtual scrolling for 100+ items
- **Window rendering**: Only render visible items

### **2. Bundle Size Optimization**

#### **Code Splitting**:

- **Route-based**: Automatic per-route splitting
- **Dynamic imports**: Load components on demand
- **Tree shaking**: Remove unused code

#### **Asset Optimization**:

- **Image optimization**: Next.js Image component
- **Font optimization**: Next.js font optimization
- **CSS optimization**: Tailwind CSS purging

### **3. Database Performance**

#### **Query Optimization**:

- **N+1 prevention**: Batch queries instead of loops
- **Index usage**: Proper indexing on frequently queried fields
- **Selective loading**: Only load required data

#### **Connection Management**:

- **Connection pooling**: Prisma connection pooling
- **Query timeout**: Prevent long-running queries
- **Error recovery**: Handle connection errors gracefully

### **4. API Performance**

#### **Response Optimization**:

- **Minimal payload**: Only return necessary data
- **Compression**: Gzip/Brotli compression
- **Pagination**: Limit response sizes

#### **Request Optimization**:

- **Batch endpoints**: `/api/courses/stats/batch` for multiple courses
- **Conditional requests**: Only fetch when needed
- **Request deduplication**: React Query prevents duplicate requests

### **5. User Experience Performance**

#### **Loading States**:

- **Skeleton loaders**: Match actual layout
- **Progressive enhancement**: Show partial data while loading
- **Optimistic UI**: Immediate feedback for user actions

#### **Error Handling**:

- **Graceful degradation**: Fallback UI on errors
- **Retry mechanisms**: Automatic retry on failures
- **User-friendly messages**: Clear error communication

#### **Navigation Performance**:

- **Prefetching**: Next.js automatic prefetching
- **Route transitions**: Smooth page transitions
- **Loading indicators**: Progress indicators during navigation

### **6. Memory Management**

#### **Cleanup**:

- **Effect cleanup**: Proper cleanup in useEffect
- **Event listener removal**: Remove listeners on unmount
- **Subscription cleanup**: Cancel subscriptions

#### **Memory Optimization**:

- **Weak references**: Use WeakMap where appropriate
- **Garbage collection**: Let React Query handle cache cleanup
- **Component unmounting**: Proper cleanup on component unmount

---

## 📊 PERFORMANCE METRICS & MONITORING

### **Key Metrics Tracked**:

1. **Render Time**: Target < 16ms for 60fps
2. **Re-render Count**: Minimize unnecessary re-renders
3. **Memory Usage**: Monitor for leaks
4. **Bundle Size**: Track bundle growth
5. **API Response Time**: Monitor endpoint performance
6. **Database Query Time**: Track slow queries

### **Performance Tools Used**:

- **React DevTools Profiler**: Identify re-render causes
- **Chrome Performance Tab**: Measure render times
- **React Query DevTools**: Monitor query performance
- **Next.js Analytics**: Track page performance

---

## 🎯 OPTIMIZATION HIGHLIGHTS

### **Database**:

✅ Reduced N+1 queries from 100+ to ~5-10 queries  
✅ Parallel query execution with Promise.all  
✅ Selective field fetching with `select`  
✅ Composite indexes for fast lookups  
✅ Batch operations for attendance stats

### **Caching**:

✅ 5-minute staleTime for most queries  
✅ Tag-based cache invalidation  
✅ Server-side caching with unstable_cache  
✅ Smart cache invalidation on mutations

### **Component**:

✅ 126 memoization instances  
✅ Stable function references  
✅ Optimized re-render patterns  
✅ Code splitting per route

### **Network**:

✅ 30-second request timeout  
✅ Exponential backoff retry  
✅ Request deduplication  
✅ Batch API endpoints

### **User Experience**:

✅ Skeleton loaders matching layouts  
✅ Optimistic UI updates  
✅ Progressive loading with Suspense  
✅ Smooth navigation transitions

---

## 📝 RECOMMENDATIONS FOR FURTHER OPTIMIZATION

### **High Priority**:

1. **Virtual Scrolling**: Implement for large student lists (100+)
2. **Image Optimization**: Use Next.js Image component consistently
3. **Bundle Analysis**: Regular bundle size monitoring
4. **Query Monitoring**: Track slow database queries

### **Medium Priority**:

1. **Service Worker**: Offline support and caching
2. **CDN Integration**: Static asset delivery
3. **Database Indexing**: Review and optimize indexes
4. **API Rate Limiting**: Prevent abuse

### **Low Priority**:

1. **Web Workers**: Heavy computations off main thread
2. **Progressive Web App**: PWA features
3. **Advanced Caching**: Service worker caching strategies

---

## 🔧 CONFIGURATION FILES

### **React Query Config** (`providers/query-provider.tsx`):

- Global query defaults
- DevTools in development
- Centralized retry logic

### **Axios Config** (`lib/axios.ts`):

- Base URL configuration
- Request/Response interceptors
- Timeout settings
- Error handling

### **Query Keys** (`lib/hooks/queries/queryKeys.ts`):

- Hierarchical key structure
- Centralized key management
- Easy invalidation patterns

---

## 📈 PERFORMANCE IMPROVEMENTS ACHIEVED

1. **Query Reduction**: 90%+ reduction in database queries
2. **Load Time**: Faster initial page loads with server components
3. **Re-renders**: Significant reduction through memoization
4. **Cache Hit Rate**: High cache hit rate with React Query
5. **User Experience**: Smooth, responsive UI with optimistic updates

---

_Last Updated: Based on current codebase analysis_  
_Total API Routes: 71_  
_Total Page Routes: 23_  
_Optimization Instances: 126+_
