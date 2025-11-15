export interface Student {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  studentId: string;
  image?: string;
  rfid_id?: number;
  attendanceRecords?: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
}

export interface TermGrades {
  prelims?: TermGradeData;
  midterm?: TermGradeData;
  preFinals?: TermGradeData;
  finals?: TermGradeData;
}

export interface TermGradeData {
  ptScores: Assessment[];
  quizScores: Assessment[];
  examScore?: Assessment;
  totalPercentage?: number;
  numericGrade?: number;
  remarks?: string;
}

export interface Assessment {
  id: string;
  name: string;
  score?: number;
  maxScore: number;
  percentage?: number;
}

export interface StudentWithGrades extends Student {
  termGrades: TermGrades;
}

export interface StudentWithRecords extends Student {
  hasAttendance: boolean;
  hasGrades: boolean;
}

export interface CourseStats {
  totalStudents: number;
  attendanceRate: number;
  averageGrade: number;
  totalAbsents: number;
  totalLate: number;
  totalExcused: number;
  passingRate: number;
}

export interface CourseInfo {
  id: string;
  code: string;
  title: string;
  section: string;
  room: string;
  semester: string;
  academicYear: string;
  slug: string;
}

export interface ImportStatus {
  imported: number;
  skipped: number;
  errors: Array<{ studentId: string; message: string }>;
  total: number;
  detailedFeedback: Array<{
    row: number;
    studentId: string;
    status: string;
    message: string;
  }>;
}

export const TERMS = ["PRELIMS", "MIDTERM", "PRE-FINALS", "FINALS"] as const;
