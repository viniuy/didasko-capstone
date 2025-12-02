import { prisma } from "@/lib/prisma";
import { UserStatus, Role, WorkType } from "@prisma/client";

export async function getDashboardData() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  const fullTimeCount = await prisma.user.count({
    where: { 
      workType: WorkType.FULL_TIME, 
      roles: { has: Role.FACULTY }
    },
  });

  const partTimeCount = await prisma.user.count({
    where: { 
      workType: WorkType.PART_TIME, 
      roles: { has: Role.FACULTY }
    },
  });

  const activeCount = await prisma.user.count({
    where: { status: UserStatus.ACTIVE },
  });

  const archivedCount = await prisma.user.count({
    where: { status: UserStatus.ARCHIVED },
  });

  const totalUsers = await prisma.user.count();

  return {
    users,
    fullTimeCount,
    partTimeCount,
    activeCount,
    archivedCount,
    totalUsers,
  };
}
