// Main component
export { CourseDashboard } from "../components/course-dashboard";

// Feature components
export { AddStudentSheet } from "../sheets/add-student-sheet";
export { RemoveStudentSheet } from "../sheets/remove-student-sheet";
export { TermGradesTab } from "../components/term-grades";

// UI components
export {
  LoadingSpinner,
  StatsCard,
  StudentAvatar,
  AttendanceVisualizer,
  AttendanceLegend,
  getAttendanceIcon,
} from "../components/ui-components";

// Types
export type {
  Student,
  AttendanceRecord,
  TermGrades,
  TermGradeData,
  Assessment,
  StudentWithGrades,
  StudentWithRecords,
  CourseStats,
  CourseInfo,
  ImportStatus,
} from "../types/types";

// Utils
export { getInitials } from "../utils/initials";
