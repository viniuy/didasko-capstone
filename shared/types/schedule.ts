export interface Schedule {
  id: string;
  courseId: string;
  day: string;
  fromTime: string;
  toTime: string;
  course?: {
    id: string;
    code: string;
    title: string;
    room?: string;
    semester: string;
    section: string;
  };
}

export interface ScheduleCreateInput {
  courseId: string;
  day: string;
  fromTime: string;
  toTime: string;
  room: string;
}

export interface ScheduleUpdateInput extends Partial<ScheduleCreateInput> {}

export interface ScheduleResponse {
  schedules: Schedule[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
