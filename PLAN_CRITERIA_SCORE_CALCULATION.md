# Plan: Calculate True Score from Linked Criteria

## Problem Statement

When linking a criteria to an assessment in class-record, the system currently uses `grade.value` (percentage 0-100) and converts it to a score. However, this doesn't account for the precise rubric weight calculations. We need to:

1. Get the raw rubric scores from the Grade model
2. Calculate the weighted percentage using the exact same formula as grading-table.tsx
3. Convert that percentage to the actual score based on `assessment.maxScore`
4. **Auto-set `assessment.maxScore` to `criteria.scoringRange` when linking** (new requirement)
5. **Optimize queries to avoid connection pool exhaustion** (new requirement)

## Optimization Strategy

### Key Principles:

1. **Batch Fetching**: Use single queries with `include` or `where: { id: { in: [...] } }` instead of N+1 queries
2. **Map Lookup**: Cache data in `Map` for O(1) lookups instead of repeated array searches
3. **Single Connection**: Minimize database connections by batching operations
4. **Parallel Processing**: Use `Promise.all` only for independent operations, not for database queries that share connections

### Implementation:

- ✅ `getClassRecordData`: Use `include` to fetch criteria with rubrics in one query
- ✅ `saveTermConfigs`: Batch fetch all criteria in one `findMany` query before processing assessments
- ✅ Cache criteria metadata in component state to avoid repeated lookups

## Current Flow Analysis

### Current Implementation Issues:

1. **`lib/services/grading.ts` (line 536-566)**: Only fetches `grade.value` (percentage), not the raw `scores` array
2. **`class-record.tsx` (line 885-910)**: Uses percentage directly and converts to score, but doesn't recalculate from raw scores
3. **Missing Data**: Criteria rubrics (with weights) are not fetched when loading class record data

### What We Need:

- Raw rubric scores: `grade.scores` (JSON array, e.g., `[4, 3, 5, 4]`)
- Rubric weights: From `Criteria.rubrics` (e.g., `[{percentage: 30}, {percentage: 20}, {percentage: 20}, {percentage: 30}]`)
- Scoring range: From `Criteria.scoringRange` (e.g., `"5"` for 1-5 scale)
- Assessment maxScore: From `Assessment.maxScore` (e.g., `50`)

## Implementation Plan

### Phase 1: Database Query Updates

#### 1.1 Update `getClassRecordData` in `lib/services/grading.ts`

**Location**: Line 536-566

**Changes**:

- Fetch `scores` (JSON) and `criteriaId` from Grade model
- Fetch Criteria with Rubrics (include rubrics relation) - **OPTIMIZED: Single query with include**
- Store both raw scores and criteria metadata
- **OPTIMIZATION**: Use `include` to fetch criteria in the same query, avoiding N+1 queries

**Code Changes**:

```typescript
// Current (line 536-545):
prisma.grade.findMany({
  where: { courseId: course.id },
  select: {
    studentId: true,
    criteriaId: true,
    value: true, // ❌ Only percentage
  },
});

// New (OPTIMIZED - Single query with include, no N+1):
prisma.grade.findMany({
  where: { courseId: course.id },
  select: {
    studentId: true,
    criteriaId: true,
    value: true, // Keep for backward compatibility
    scores: true, // ✅ Add raw rubric scores
    total: true, // ✅ Add total percentage
  },
  include: {
    criteria: {
      // ✅ Include criteria with rubrics in SAME query (avoids connection pool exhaustion)
      select: {
        id: true,
        scoringRange: true,
        rubrics: {
          select: {
            id: true,
            name: true,
            percentage: true,
          },
          orderBy: { createdAt: "asc" }, // Ensure consistent order
        },
      },
    },
  },
  // ✅ OPTIMIZATION: Limit to reduce memory if needed (optional)
  // take: 10000, // Adjust based on typical class size
});
```

#### 1.2 Add Database Index (Optional but Recommended)

**Location**: `prisma/schema.prisma`

**Rationale**: If we frequently query grades by `criteriaId`, an index helps.

**Code**:

```prisma
model Grade {
  // ... existing fields ...

  @@index([criteriaId])  // ✅ Already exists (line 132)
  @@index([courseId, criteriaId])  // ✅ Add composite index for common queries
}
```

**Note**: Check if `@@index([criteriaId])` already exists. If yes, the composite index might still help.

### Phase 2: Data Structure Updates

#### 2.1 Update `ClassRecordData` Interface

**Location**: `features/grading/components/class-record.tsx` (line 303-334)

**Changes**:

- Add criteria metadata to the data structure
- Store raw scores alongside percentage

**Code**:

```typescript
interface ClassRecordData {
  // ... existing fields ...
  assessmentScores: Record<string, any>;
  criteriaMetadata?: Record<
    string,
    {
      // ✅ New: Criteria metadata cache
      scoringRange: number;
      rubrics: Array<{ percentage: number }>;
    }
  >;
}
```

#### 2.2 Update Data Initialization

**Location**: `features/grading/components/class-record.tsx` (line 602-690)

**Changes**:

- Extract and cache criteria metadata
- Store raw scores for linked criteria

**Code**:

```typescript
// In initializeData function:
const criteriaMetadata: Record<string, any> = {};
const assessmentScoresMap = new Map<string, StudentScore>();

// Process grades
criteriaScores.forEach((grade: any) => {
  const key = `${grade.studentId}:criteria:${grade.criteriaId}`;

  // Store raw scores and metadata
  assessmentScoresMap.set(key, {
    studentId: grade.studentId,
    assessmentId: `criteria:${grade.criteriaId}`,
    score: grade.value, // Keep percentage for now
    rawScores: grade.scores, // ✅ Add raw rubric scores
    criteriaId: grade.criteriaId, // ✅ Add for lookup
  });

  // Cache criteria metadata (only once per criteria)
  if (grade.criteria && !criteriaMetadata[grade.criteriaId]) {
    criteriaMetadata[grade.criteriaId] = {
      scoringRange: Number(grade.criteria.scoringRange) || 5,
      rubrics: grade.criteria.rubrics.map((r: any) => ({
        percentage: r.percentage,
      })),
    };
  }
});

// Store in state or pass to component
setCriteriaMetadata(criteriaMetadata);
```

### Phase 3: Score Calculation Function

#### 3.1 Create Precise Score Calculation Function

**Location**: `features/grading/components/class-record.tsx`

**New Function** (add after `getLinkedCriteriaScore`):

```typescript
/**
 * Calculate weighted percentage from raw rubric scores
 * Uses the same formula as grading-table.tsx calculateTotal
 */
const calculateWeightedPercentage = (
  rawScores: number[],
  rubrics: Array<{ percentage: number }>,
  scoringRange: number
): number => {
  if (!rawScores || !rubrics || rubrics.length === 0) return 0;

  // Ensure we only use scores up to the number of rubrics
  const validScores = rawScores.slice(0, rubrics.length);

  // Calculate weighted percentage for each rubric
  const weightedScores = validScores.map((score, index) => {
    const weight = rubrics[index]?.percentage || 0;
    // Convert score to percentage based on max score, then apply weight
    return (score / scoringRange) * weight;
  });

  // Sum up all weighted scores and round to 2 decimal places
  const total = Number(
    weightedScores.reduce((sum, score) => sum + score, 0).toFixed(2)
  );

  return total;
};

/**
 * Get the true score (not percentage) from linked criteria
 */
const getTrueScoreFromCriteria = (
  studentId: string,
  criteriaId: string,
  assessmentMaxScore: number
): number | null => {
  const gradeData = scores.get(`${studentId}:criteria:${criteriaId}`);
  if (!gradeData) return null;

  // Get raw scores and criteria metadata
  const rawScores = (gradeData as any).rawScores;
  const criteriaMeta = criteriaMetadata?.[criteriaId];

  if (!rawScores || !criteriaMeta) {
    // Fallback: use percentage if raw scores not available
    const percentage = gradeData.score;
    if (percentage === null) return null;
    return Math.round((percentage / 100) * assessmentMaxScore * 100) / 100;
  }

  // Calculate weighted percentage from raw scores
  const weightedPercentage = calculateWeightedPercentage(
    rawScores,
    criteriaMeta.rubrics,
    criteriaMeta.scoringRange
  );

  // Convert percentage to actual score
  const trueScore = (weightedPercentage / 100) * assessmentMaxScore;
  return Math.round(trueScore * 100) / 100;
};
```

#### 3.2 Update `getEffectiveScore` Function

**Location**: `features/grading/components/class-record.tsx` (line 893-910)

**Changes**:

- Use `getTrueScoreFromCriteria` instead of percentage conversion

**Code**:

```typescript
const getEffectiveScore = (
  studentId: string,
  assessment: Assessment
): number | null => {
  if (assessment.linkedCriteriaId) {
    // ✅ Use new function to get true score
    return getTrueScoreFromCriteria(
      studentId,
      assessment.linkedCriteriaId,
      assessment.maxScore
    );
  }
  return getScore(studentId, assessment.id);
};
```

### Phase 4: State Management Updates

#### 4.1 Add Criteria Metadata State

**Location**: `features/grading/components/class-record.tsx` (around line 420)

**Code**:

```typescript
const [criteriaMetadata, setCriteriaMetadata] = useState<
  Record<
    string,
    {
      scoringRange: number;
      rubrics: Array<{ percentage: number }>;
    }
  >
>({});
```

#### 4.2 Update Data Initialization

**Location**: `features/grading/components/class-record.tsx` (line 602-690)

**Code**:

```typescript
// In initializeData function, after processing grades:
if (classRecordData.criteriaMetadata) {
  setCriteriaMetadata(classRecordData.criteriaMetadata);
}
```

### Phase 5: Backend API Updates (if needed)

#### 5.1 Update `getClassRecordData` Response

**Location**: `lib/services/grading.ts` (line 479-607)

**Changes**:

- Include criteria metadata in response
- Include raw scores in grade data

**Code**:

```typescript
// In the return statement (around line 600):
return {
  students,
  termConfigs,
  assessmentScores: scoresMap,
  criteriaLinks,
  criteriaMetadata, // ✅ Add this
};
```

#### 5.2 Update API Route (if separate)

**Location**: Check if there's an API route that calls `getClassRecordData`

**Changes**:

- Ensure it passes through the new `criteriaMetadata` field

#### 5.3 Update Frontend SettingsModal (Optional - for better UX)

**Location**: `features/grading/components/SettingsModal.tsx` (line 1247-1249)

**Current Behavior**: Sets `maxScore: linkedCriteria.maxScore` (which is just scoringRange)

**Changes**:

- The backend now handles this automatically, but frontend can still set it for immediate UI feedback
- No changes needed - backend will override with correct value on save

**Note**: The backend optimization ensures this happens efficiently even if frontend doesn't set it.

## Performance Considerations

### Indexing Strategy

1. **Existing Index**: `@@index([criteriaId])` on Grade model (already exists)
2. **Composite Index**: Consider `@@index([courseId, criteriaId])` for common query patterns
3. **Evaluation**: Monitor query performance after implementation

### Caching Strategy

1. **Criteria Metadata**: Cache once per criteria (doesn't change often)
2. **Raw Scores**: Already fetched with grades, no additional query needed
3. **Calculation**: Done client-side, minimal performance impact

### Query Optimization

1. **Single Query with Include**: Use `include` to fetch criteria with rubrics in one query (avoids N+1)
2. **Batch Processing**: Process all grades in one pass
3. **Memory**: Criteria metadata is small (few KB per criteria)
4. **Connection Pool**: Single query per operation prevents pool exhaustion
5. **Map Lookup**: Use `Map` for O(1) criteria lookup instead of array.find()
6. **Parallel Processing**: Use `Promise.all` for independent operations only (not for database queries that share connections)

## Testing Plan

### Test Cases

1. **Basic Calculation**: 4 rubrics with weights [30%, 20%, 20%, 30%], scores [4, 3, 5, 4], range 5, maxScore 50

   - Expected: `((4/5)*30 + (3/5)*20 + (5/5)*20 + (4/5)*30) / 100 * 50 = 42.0`

2. **Edge Cases**:

   - Missing raw scores (fallback to percentage)
   - Missing criteria metadata (fallback to percentage)
   - Empty scores array
   - Scores array shorter than rubrics array

3. **Integration**:
   - Link criteria to assessment
   - Verify score appears correctly in class record
   - Verify calculations match grading-table.tsx

## Migration Strategy

### Backward Compatibility

1. **Fallback Logic**: If raw scores not available, use percentage (current behavior)
2. **Gradual Rollout**: New data includes raw scores, old data still works
3. **No Breaking Changes**: Existing functionality continues to work

### Data Migration (if needed)

- Existing grades already have `scores` field (JSON)
- No migration needed if data already exists
- If missing, can recalculate from `value` (less precise)

## Additional Requirement: Auto-Set maxScore When Linking

### Problem:

When linking a criteria to an assessment, the assessment's `maxScore` should be automatically set to the criteria's computed maximum (scoringRange).

### Solution:

1. When `linkedCriteriaId` is set in `saveTermConfigs`, fetch criteria data
2. Set `assessment.maxScore = criteria.scoringRange` (the maximum possible score)
3. Optimize to batch fetch all criteria in a single query to avoid connection pool exhaustion

### Implementation:

#### Update `saveTermConfigs` in `lib/services/grading.ts` (line 50-173)

**Optimized Approach**:

```typescript
export async function saveTermConfigs(
  courseSlug: string,
  termConfigs: Record<string, any>
) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Validate weights
  for (const [term, config] of Object.entries(termConfigs)) {
    const total = config.ptWeight + config.quizWeight + config.examWeight;
    if (total !== 100) {
      throw new Error(`${term}: Weights must total 100%`);
    }
  }

  // ✅ OPTIMIZATION: Collect all unique criteriaIds that will be linked
  const criteriaIdsToFetch = new Set<string>();
  Object.values(termConfigs).forEach((config: any) => {
    config.assessments?.forEach((assessment: any) => {
      if (assessment.linkedCriteriaId) {
        criteriaIdsToFetch.add(assessment.linkedCriteriaId);
      }
    });
  });

  // ✅ OPTIMIZATION: Batch fetch all criteria in ONE query (avoids N+1 and pool exhaustion)
  const criteriaMap = new Map<
    string,
    { scoringRange: number; rubrics: any[] }
  >();
  if (criteriaIdsToFetch.size > 0) {
    const criteriaList = await prisma.criteria.findMany({
      where: { id: { in: Array.from(criteriaIdsToFetch) } },
      select: {
        id: true,
        scoringRange: true,
        rubrics: {
          select: {
            id: true,
            name: true,
            percentage: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Build map for O(1) lookup
    criteriaList.forEach((c) => {
      criteriaMap.set(c.id, {
        scoringRange: Number(c.scoringRange) || 5,
        rubrics: c.rubrics,
      });
    });
  }

  // Process each term config in parallel for better performance
  const termConfigPromises = Object.entries(termConfigs).map(
    async ([term, config]) => {
      try {
        const termConfig = await prisma.termConfiguration.upsert({
          where: {
            courseId_term: {
              courseId: course.id,
              term,
            },
          },
          create: {
            courseId: course.id,
            term,
            ptWeight: config.ptWeight,
            quizWeight: config.quizWeight,
            examWeight: config.examWeight,
          },
          update: {
            ptWeight: config.ptWeight,
            quizWeight: config.quizWeight,
            examWeight: config.examWeight,
          },
        });

        const existingAssessments = await prisma.assessment.findMany({
          where: { termConfigId: termConfig.id },
          select: { id: true },
        });

        const existingIds = existingAssessments.map((a) => a.id);
        const incomingIds = config.assessments
          .filter((a: any) => a.id && !a.id.startsWith("temp"))
          .map((a: any) => a.id);

        const idsToDelete = existingIds.filter(
          (id) => !incomingIds.includes(id)
        );

        // Batch delete assessments
        if (idsToDelete.length > 0) {
          await prisma.assessment.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }

        // Batch create/update assessments using Promise.all
        const assessmentPromises = config.assessments.map(
          async (assessment: any) => {
            const existsInDb = existingIds.includes(assessment.id);

            // ✅ AUTO-SET maxScore when linking criteria
            let computedMaxScore = assessment.maxScore;
            if (assessment.linkedCriteriaId) {
              const criteria = criteriaMap.get(assessment.linkedCriteriaId);
              if (criteria) {
                // Set maxScore to criteria's scoringRange (max possible score)
                computedMaxScore = criteria.scoringRange;
              }
            }

            const assessmentData = {
              name: assessment.name,
              maxScore: computedMaxScore, // ✅ Use computed maxScore
              date: assessment.date ? new Date(assessment.date) : null,
              enabled: assessment.enabled,
              order: assessment.order,
              linkedCriteriaId: assessment.linkedCriteriaId ?? null,
              transmutationBase: assessment.transmutationBase ?? 0,
            };

            if (
              !existsInDb ||
              !assessment.id ||
              assessment.id.startsWith("temp")
            ) {
              return prisma.assessment.create({
                data: {
                  termConfigId: termConfig.id,
                  type: assessment.type as AssessmentType,
                  ...assessmentData,
                },
              });
            } else {
              return prisma.assessment.update({
                where: { id: assessment.id },
                data: assessmentData,
              });
            }
          }
        );

        await Promise.all(assessmentPromises);
      } catch (error: any) {
        // ... error handling
      }
    }
  );

  await Promise.all(termConfigPromises);

  return { success: true };
}
```

**Key Optimizations**:

1. ✅ **Single Query**: Fetch all criteria in one `findMany` with `where: { id: { in: [...] } }`
2. ✅ **Map Lookup**: Use `Map` for O(1) lookup instead of repeated queries
3. ✅ **Batch Processing**: Process all assessments in parallel with `Promise.all`
4. ✅ **No N+1 Queries**: Avoids opening multiple connections for each criteria

## Summary

### Key Changes:

1. ✅ Fetch `scores` (raw rubric scores) from Grade model
2. ✅ Fetch Criteria with Rubrics (weights)
3. ✅ Cache criteria metadata in component state
4. ✅ Create `calculateWeightedPercentage` function (same as grading-table.tsx)
5. ✅ Create `getTrueScoreFromCriteria` function
6. ✅ Update `getEffectiveScore` to use new calculation
7. ✅ Add fallback to percentage for backward compatibility
8. ✅ **NEW**: Auto-set `assessment.maxScore = criteria.scoringRange` when linking
9. ✅ **NEW**: Optimize `saveTermConfigs` to batch fetch criteria (single query)

### Efficiency:

- **Indexing**: `@@index([criteriaId])` already exists, composite index optional
- **Queries**: Single query with `include` (efficient)
- **Caching**: Criteria metadata cached (small, infrequent changes)
- **Calculation**: Client-side, O(n) where n = number of rubrics (typically 2-5)

### Answer to User's Question:

**"Would adding @@index for this be efficient?"**

- The `@@index([criteriaId])` already exists on Grade model
- A composite index `@@index([courseId, criteriaId])` could help if we frequently query by both
- However, the main performance gain comes from:
  1. Fetching data in a single query with `include` (avoiding N+1 queries)
  2. Caching criteria metadata (avoiding repeated lookups)
  3. The calculation itself is O(n) and very fast

**Recommendation**: The existing index is sufficient. Focus on the query optimization and caching strategy first, then monitor performance and add composite index only if needed.
