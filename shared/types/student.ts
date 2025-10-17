export interface Student {
  id: string;
  lastName: string;
  firstName: string;
  middleInitial?: string | null;
  image?: string | null;
  studentId: string;
  createdAt: Date;
  updatedAt: Date;
  coursesEnrolled?: Array<{
    id: string;
    code: string;
    title: string;
    section: string;
  }>;
}

export interface StudentCreateInput {
  lastName: string;
  firstName: string;
  middleInitial?: string;
  image?: string;
  studentId: string;
  courseId?: string;
}

export interface StudentUpdateInput extends Partial<StudentCreateInput> {}

export interface StudentResponse {
  students: Student[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RfidScanInput {
  rfidUid: string;
}

export interface RfidScanResponse {
  found: boolean;
  student?: Student;
  message: string;
}
