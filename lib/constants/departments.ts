/**
 * Centralized list of valid departments in the system
 * Used for validation in forms and import endpoints
 */
export const DEPARTMENTS = [
  "IT Department",
  "BA Department",
  "HM Department",
  "TM Department",
  "GE Department",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

/**
 * Validates if a department string is valid
 */
export function isValidDepartment(department: string): boolean {
  return DEPARTMENTS.includes(department as Department);
}
