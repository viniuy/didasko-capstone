import "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    role?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
  
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "ADMIN" | "ACADEMIC_HEAD" | "FACULTY";
      selectedRole?: string;
      department?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    selectedRole?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    department?: string | null;
  }
}