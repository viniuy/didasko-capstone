export interface Course {
  id: string;
  code: string;
  title: string;
  description?: string;
  room?: string;
  semester: string;
  section: string;
  facultyId: string | null;
  createdAt: Date;
  updatedAt: Date;
  faculty: {
    id: string;
    name: string;
    email: string;
    department: string;
  } | null;
  students: Array<{
    id: string;
    lastName: string;
    firstName: string;
    middleInitial?: string | null;
  }>;
  schedules: Array<{
    id: string;
    day: Date;
    fromTime: string;
    toTime: string;
  }>;
}

export interface CourseCreateInput {
  id?: string;
  code: string;
  title: string;
  room?: string;
  semester: string;
  section: string;
  facultyId: string;
}

export interface CourseUpdateInput extends Partial<CourseCreateInput> {}

export interface CourseResponse {
  courses: Course[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
