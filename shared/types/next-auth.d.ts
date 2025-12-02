import "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    roles?: Role[];
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
      roles: Role[];
      selectedRole?: Role;
      department?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: Role[];
    selectedRole?: Role;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    department?: string | null;
  }
}
