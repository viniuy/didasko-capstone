export interface CourseSchedule {
  id: string;
  courseId: string;
  day: string;
  fromTime: string;
  toTime: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface CourseUpdateInput {
  code: string;
  title: string;
  room: string;
  semester: string;
  section: string;
  facultyId: string;
  academicYear: string;
  status: "ACTIVE" | "ARCHIVED";
}

export interface StudentInCourse {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
}

export interface FacultyInfo {
  id: string;
  name: string;
  email: string;
  department: string;
}

export interface AttendanceStats {
  totalStudents: number;
  totalPresent: number;
  totalAbsents: number;
  totalLate: number;
  lastAttendanceDate: Date | null;
  attendanceRate: number;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  room: string;
  semester: string;
  slug: string;
  academicYear: string;
  classNumber: number;
  status: "ACTIVE" | "ARCHIVED";
  section: string;
  facultyId: string | null;
  createdAt: Date;
  updatedAt: Date;

  schedules: CourseSchedule[];
  students: StudentInCourse[];
  faculty?: FacultyInfo | null;

  attendanceStats?: AttendanceStats;
}

export interface CourseResponse {
  courses: Course[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateCourseInput {
  code: string;
  title: string;
  section: string;
  room: string;
  semester: string;
  academicYear: string;
  classNumber: number;
  status: "ACTIVE" | "ARCHIVED";
  facultyId: string;
  schedules: {
    day: string;
    fromTime: string;
    toTime: string;
  }[];
}

export interface UpdateSchedulesInput {
  schedules: {
    day: string;
    fromTime: string;
    toTime: string;
  }[];
}
