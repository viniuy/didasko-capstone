# Grading Table Component Optimization Recommendations

## Executive Summary

The `grading-table.tsx` component is **3,869 lines** and has several performance bottlenecks. Here are prioritized optimization recommendations to improve render performance, reduce unnecessary re-renders, and enhance maintainability.

---

## 🔴 CRITICAL (High Impact, Low Effort)

### 1. **Memoize Expensive Functions with `useCallback`**

**Impact:** Prevents unnecessary re-renders of child components  
**Effort:** Low  
**Lines:** 999-1062, 1064-1088, 1757-1790, 1875-1891

**Issues:**

- `handleScoreChange` - Recreated on every render, causes `GradingTableRow` to re-render
- `calculateTotal` - Recreated on every render, called frequently
- `getPaginatedStudents` - Recreated on every render, duplicates filtering logic
- `handleFilterChange` - Recreated on every render
- `studentMatchesFilter` - Recreated on every render

**Fix:**

```typescript
const handleScoreChange = useCallback(
  async (studentId: string, rubricIndex: number, value: number | "") => {
    // ... existing logic
  },
  [
    activeReport,
    selectedDate,
    courseSlug,
    isRecitationCriteria,
    rubricDetails.length,
  ]
);

const calculateTotal = useCallback(
  (scores: number[]): number => {
    // ... existing logic
  },
  [rubricDetails, activeReport?.scoringRange]
);

const studentMatchesFilter = useCallback(
  (student: Student) => {
    // ... existing logic
  },
  [gradeFilter, activeReport?.passingScore, scores]
);
```

---

### 2. **Memoize Filtered & Paginated Students**

**Impact:** Eliminates duplicate filtering, reduces computation  
**Effort:** Low  
**Lines:** 1875-1891, 1894-1905

**Issues:**

- `getPaginatedStudents` is called in render AND a separate useEffect duplicates the same filtering
- Filtering happens twice on every render

**Fix:**

```typescript
// Single memoized computation
const { filteredStudents, paginatedStudents, totalPages, totalStudents } =
  useMemo(() => {
    const filtered = students.filter((student) => {
      const name = `${student.lastName || ""} ${student.firstName || ""} ${
        student.middleInitial || ""
      }`.toLowerCase();
      const nameMatch = name.includes(searchQuery.toLowerCase());
      return nameMatch && studentMatchesFilter(student);
    });

    const startIndex = (currentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;

    return {
      filteredStudents: filtered,
      paginatedStudents: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / studentsPerPage),
      totalStudents: filtered.length,
    };
  }, [
    students,
    searchQuery,
    gradeFilter,
    currentPage,
    studentsPerPage,
    studentMatchesFilter,
  ]);

// Remove the separate useEffect (lines 1894-1905)
```

---

### 3. **Replace Deep Clone with Shallow Copy**

**Impact:** 10-100x faster for large score objects  
**Effort:** Low  
**Lines:** 971, 941, 2799

**Issues:**

- `JSON.parse(JSON.stringify(scores))` is extremely slow for large objects
- Used in multiple places: `handleSaveGrades`, `handleResetGrades`

**Fix:**

```typescript
// Instead of:
setOriginalScores(JSON.parse(JSON.stringify(scores)));

// Use structuredClone (modern browsers) or shallow copy:
setOriginalScores(structuredClone(scores));
// OR for shallow copy (if nested objects don't need deep copy):
setOriginalScores({ ...scores });
// For nested objects, use a utility:
const deepCloneScores = (scores: Record<string, GradingScore>) => {
  const cloned: Record<string, GradingScore> = {};
  Object.keys(scores).forEach((key) => {
    cloned[key] = {
      ...scores[key],
      scores: [...scores[key].scores],
    };
  });
  return cloned;
};
```

---

### 4. **Extract GroupViewTable to Separate Component**

**Impact:** Prevents recreation on every render  
**Effort:** Low  
**Lines:** 1912-2067

**Issues:**

- `GroupViewTable` is defined inside the main component
- Recreated on every render, causing unnecessary work

**Fix:**

```typescript
// Move to separate file: features/grading/components/group-view-table.tsx
export const GroupViewTable = React.memo(
  ({
    students,
    scores,
    rubricDetails,
    activeReport,
    handleScoreChange,
  }: GroupViewTableProps) => {
    // ... existing logic
  }
);
```

---

## 🟠 HIGH PRIORITY (Significant Impact)

### 5. **Optimize useEffect Dependencies**

**Impact:** Reduces unnecessary effect runs  
**Effort:** Medium  
**Lines:** 677-775, 1477-1529

**Issues:**

- Large dependency arrays cause effects to run too frequently
- Some dependencies might not need to trigger re-runs

**Fix:**

```typescript
// Use refs for values that don't need to trigger re-runs
const allReportsRef = useRef(allReports);
allReportsRef.current = allReports;

// Or split effects into smaller, focused ones
useEffect(() => {
  // Only handle criteria loading
}, [isLoadingCriteria, isLoadingRecitation, isLoadingGroupCriteria]);

useEffect(() => {
  // Only handle filtering
}, [allReports, isGroupView, isRecitationCriteria]);
```

---

### 6. **Batch State Updates**

**Impact:** Reduces render cycles  
**Effort:** Medium  
**Lines:** Multiple locations

**Issues:**

- Multiple `setState` calls in sequence cause multiple renders
- React 18 auto-batches, but some patterns could be improved

**Fix:**

```typescript
// Instead of:
setActiveReport(selected);
setRubricDetails(selected.rubrics);
setHasSelectedCriteria(true);
setShowCriteriaDialog(false);

// Use React.startTransition for non-urgent updates:
startTransition(() => {
  setActiveReport(selected);
  setRubricDetails(selected.rubrics);
  setHasSelectedCriteria(true);
});
setShowCriteriaDialog(false); // Urgent UI update
```

---

### 7. **Memoize Dialog/Modal Props**

**Impact:** Prevents unnecessary re-renders of dialogs  
**Effort:** Medium  
**Lines:** 2828-3255 (Dialog components)

**Issues:**

- Dialog props are recreated on every render
- Large inline objects/functions passed as props

**Fix:**

```typescript
const dialogProps = useMemo(
  () => ({
    isOpen: showCriteriaDialog,
    onClose: handleDialogClose,
    // ... other props
  }),
  [showCriteriaDialog /* other deps */]
);

// Or extract dialog components to separate files with React.memo
```

---

## 🟡 MEDIUM PRIORITY (Code Quality & Maintainability)

### 8. **Split Component into Smaller Pieces**

**Impact:** Better maintainability, easier optimization  
**Effort:** High  
**Current:** 3,869 lines in one file

**Recommended Split:**

```
grading-table.tsx (main component, ~500 lines)
├── components/
│   ├── CriteriaDialog.tsx (~300 lines)
│   ├── CreateReportDialog.tsx (~400 lines)
│   ├── EditReportDialog.tsx (~300 lines)
│   ├── ExportDialog.tsx (~200 lines)
│   ├── FilterSheet.tsx (~150 lines)
│   └── GroupViewTable.tsx (~150 lines)
├── hooks/
│   ├── useGradingTableData.ts (~200 lines)
│   ├── useGradingTableState.ts (~300 lines)
│   └── useGradingTableFilters.ts (~150 lines)
└── utils/
    ├── gradeCalculations.ts (~100 lines)
    └── exportUtils.ts (~200 lines)
```

---

### 9. **Virtualize Large Student Lists**

**Impact:** Improves performance with 100+ students  
**Effort:** High  
**Lines:** 2656-2700 (table rendering)

**Fix:**

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

// Only render visible rows
const virtualizer = useVirtualizer({
  count: filteredStudents.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  overscan: 5,
});
```

---

### 10. **Debounce Search Input**

**Impact:** Reduces filtering computation  
**Effort:** Low  
**Lines:** 1875-1891

**Fix:**

```typescript
import { useDeferredValue } from "react";

const deferredSearchQuery = useDeferredValue(searchQuery);
// Use deferredSearchQuery in filtering logic
```

---

## 📊 Performance Metrics to Track

1. **Render Time:** Should be < 16ms for 60fps
2. **Re-render Count:** Use React DevTools Profiler
3. **Memory Usage:** Check for memory leaks in long sessions
4. **Bundle Size:** Current component likely adds significant size

---

## 🎯 Quick Wins (Do First)

1. ✅ Memoize `handleScoreChange`, `calculateTotal`, `getPaginatedStudents`
2. ✅ Replace `JSON.parse(JSON.stringify())` with structuredClone
3. ✅ Consolidate duplicate filtering logic into single `useMemo`
4. ✅ Extract `GroupViewTable` to separate component
5. ✅ Add `React.memo` to `GradingTableRow` (if not already)

**Estimated Impact:** 30-50% reduction in unnecessary re-renders, 2-5x faster state updates

---

## 📝 Implementation Order

1. **Week 1:** Critical optimizations (#1-4)
2. **Week 2:** High priority (#5-7)
3. **Week 3:** Component splitting (#8)
4. **Week 4:** Advanced optimizations (#9-10)

---

## ⚠️ Potential Pitfalls

- **Over-memoization:** Don't memoize everything - profile first
- **Dependency arrays:** Be careful when reducing dependencies - test thoroughly
- **Breaking changes:** Component splitting might require prop drilling initially
- **Testing:** Ensure all optimizations are covered by tests

---

## 🔍 Tools for Verification

1. **React DevTools Profiler:** Identify re-render causes
2. **Chrome Performance Tab:** Measure render times
3. **Why Did You Render:** Debug unnecessary re-renders
4. **Bundle Analyzer:** Check bundle size impact
