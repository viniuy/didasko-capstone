// Term Types
export const TERMS = [
  "PRELIM",
  "MIDTERM",
  "PREFINALS",
  "FINALS",
  "SUMMARY",
] as const;

export type Term = (typeof TERMS)[number];

// Assessment Types
export interface Assessment {
  id: string;
  name: string;
  type: "PT" | "QUIZ" | "EXAM";
  maxScore: number;
  date: string | null;
  enabled: boolean;
  order: number;
  linkedCriteriaId?: string | null;
  transmutationBase?: number; // Base for grade transmutation (0-75) per assessment
}

// Term Configuration
export interface TermConfig {
  id: string;
  term: Term;
  ptWeight: number;
  quizWeight: number;
  examWeight: number;
  assessments: Assessment[];
}

// Student Types
export interface Student {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial: string | null;
}

// Score Types
export interface StudentScore {
  studentId: string;
  assessmentId: string;
  score: number | null;
}

// Criteria Types
export type CriteriaType =
  | "RECITATION"
  | "GROUP_REPORTING"
  | "INDIVIDUAL_REPORTING";

export interface CriteriaOption {
  id: string;
  name: string;
  date?: string | null;
  maxScore?: number;
  type: CriteriaType;
}

// Component Props
export interface ClassRecordTableProps {
  courseSlug: string;
  courseCode: string;
  courseSection: string;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  termConfigs: Record<string, TermConfig>;
  onSave: (configs: Record<string, TermConfig>) => void;
  availableCriteria: CriteriaOption[];
}

// Grade Calculation Types
export interface TermGrade {
  totalPercent: string;
  numericGrade: string;
  ptWeighted: string;
  quizWeighted: string;
  examWeighted: string;
}

export interface FinalGrade {
  grade: string;
  remarks: "PASSED" | "FAILED";
}

// Term Weights Constants
export const TERM_WEIGHTS = {
  PRELIM: 0.2,
  MIDTERM: 0.2,
  PREFINALS: 0.2,
  FINALS: 0.4,
} as const;

export type TermWeight = typeof TERM_WEIGHTS;
