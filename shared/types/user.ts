import { Role, WorkType, Permission } from "@prisma/client";

export interface User {
  id: string;
  email: string;
  name: string;
  department: string;
  workType: WorkType;
  role: Role;
  permission: Permission;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  email: string;
  name: string;
  department: string;
  workType: WorkType;
  role: Role;
  permission: Permission;
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
