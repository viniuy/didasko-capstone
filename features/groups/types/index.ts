

import { AttendanceStatus } from "@prisma/client";

/**
 * Student type for group management
 * Used in AddGroupModal and GroupGrid
 */
export interface Student {
  id: string;
  name: string;
  status: AttendanceStatus | "NOT_SET";
}

/**
 * Group metadata containing available and used names/numbers
 */
export interface GroupMeta {
  names: string[];
  numbers: number[];
  usedNames: string[];
  usedNumbers: number[];
}

/**
 * Group type - basic structure
 */
export interface Group {
  id: string;
  number: string;
  name: string | null;
  students: GroupStudent[];
  leader: GroupStudent | null;
}

/**
 * Student as part of a group
 */
export interface GroupStudent {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial: string | null;
  image: string | null;
}

/**
 * Course type
 */
export interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  description: string | null;
}