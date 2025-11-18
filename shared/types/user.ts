import { Role, WorkType, UserStatus } from "@prisma/client";

export interface User {
  id: string;
  email: string;
  name: string;
  department: string;
  workType: WorkType;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  email: string;
  name: string;
  department: string;
  workType: WorkType;
  role: Role;
  status: UserStatus;
}

export interface UserUpdateInput extends Partial<UserCreateInput> {}

export interface UserResponse {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
