import { AttendanceStatus } from "@prisma/client";

export type AttendanceStatusWithNotSet = AttendanceStatus | "NOT_SET";

export interface FilterState {
  status: AttendanceStatusWithNotSet[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  courseId?: string;
}

export interface Student {
  id: string;
  name: string;
  image?: string;
  status: AttendanceStatusWithNotSet;
  attendanceRecords: AttendanceRecord[];
}

export interface Attendance {
  id: string;
  courseId: string;
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    lastName: string;
    firstName: string;
    middleInitial?: string | null;
  };
  course?: {
    id: string;
    code: string;
    title: string;
    section: string;
  };
}

export interface AttendanceCreateInput {
  courseId: string;
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceUpdateInput extends Partial<AttendanceCreateInput> {}

export interface AttendanceStats {
  totalStudents: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  attendanceRate: number;
  lastAttendanceDate: Date | null;
}

export interface AttendanceResponse {
  attendance: Attendance[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
