import prisma from "@/utils/database";

const FALLBACK = new Date("2023-01-01T00:00:00.000Z");

export async function getResetStart(workspaceGroupId: number) {
  const lastReset = await prisma.activityReset.findFirst({
    where: { workspaceGroupId },
    orderBy: { resetAt: "desc" },
    select: {
      resetAt: true,
      previousPeriodEnd: true,
    },
  });

  if (!lastReset) {
    return new Date(FALLBACK);
  }

  return lastReset.previousPeriodEnd ?? lastReset.resetAt;
}

export function getActivityResetStart() {
  return new Date(FALLBACK);
}