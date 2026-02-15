import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { getConfig } from "@/utils/configEngine";

type ResetResult = {
  workspaceId: number;
  workspaceName: string;
  success: boolean;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = req.headers["x-cron-secret"] || req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return res.status(500).json({ error: "CRON_SECRET not configured" });
  }

  if (!cronSecret || String(cronSecret) !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const workspaces = await prisma.workspace.findMany({
      select: {
        groupId: true,
        groupName: true,
      },
    });

    const results: ResetResult[] = [];
    const now = new Date();
    const currentDay = now.getDay();
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDayName = dayNames[currentDay];

    for (const workspace of workspaces) {
      try {
        const schedule = await getConfig(
          "activity_reset_schedule",
          workspace.groupId
        );

        if (!schedule || !schedule.enabled) {
          continue;
        }

        if (schedule.day !== currentDayName) {
          continue;
        }

        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        // Check if there's already an auto-reset today (resetById not set)
        const allTodayResets = await prisma.activityReset.findMany({
          where: { 
            workspaceGroupId: workspace.groupId,
            resetAt: {
              gte: startOfToday,
              lte: endOfToday,
            }
          },
        });
        
        const todayReset = allTodayResets.find(reset => reset.resetById === null);

        if (todayReset) {
          continue;
        }

        // Find last auto-reset (resetById not set)
        const allResets = await prisma.activityReset.findMany({
          where: { 
            workspaceGroupId: workspace.groupId,
          },
          orderBy: { resetAt: "desc" },
        });
        
        const lastAutoReset = allResets.find(reset => reset.resetById === null);

        let shouldReset = false;

        if (!lastAutoReset) {
          shouldReset = true;
        } else {
          const daysSinceLastAutoReset = Math.floor(
            (now.getTime() - lastAutoReset.resetAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (schedule.frequency === "weekly" && daysSinceLastAutoReset >= 7) {
            shouldReset = true;
          } else if (schedule.frequency === "biweekly" && daysSinceLastAutoReset >= 14) {
            shouldReset = true;
          } else if (schedule.frequency === "monthly" && daysSinceLastAutoReset >= 28) {
            shouldReset = true;
          }
        }

        if (shouldReset) {
          await performReset(workspace.groupId);
          results.push({
            workspaceId: workspace.groupId,
            workspaceName: workspace.groupName || `Workspace ${workspace.groupId}`,
            success: true,
          });
        }
      } catch (error: any) {
        results.push({
          workspaceId: workspace.groupId,
          workspaceName: workspace.groupName || `Workspace ${workspace.groupId}`,
          success: false,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${workspaces.length} workspaces`,
      results,
      resetCount: results.filter((r) => r.success).length,
    });
  } catch (error: any) {
    console.error("Error in activity reset cron:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function performReset(workspaceGroupId: number) {
  const earliestSession = await prisma.activitySession.findFirst({
    where: { workspaceGroupId },
    orderBy: { startTime: "asc" },
    select: { startTime: true },
  });

  const earliestAdjustment = await prisma.activityAdjustment.findFirst({
    where: { workspaceGroupId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  let periodStart = new Date();
  if (earliestSession && earliestAdjustment) {
    periodStart =
      earliestSession.startTime < earliestAdjustment.createdAt
        ? earliestSession.startTime
        : earliestAdjustment.createdAt;
  } else if (earliestSession) {
    periodStart = earliestSession.startTime;
  } else if (earliestAdjustment) {
    periodStart = earliestAdjustment.createdAt;
  }

  const periodEnd = new Date();
  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: { workspaceGroupId },
    include: {
      user: {
        include: {
          roles: {
            where: { workspaceGroupId },
            include: { quotaRoles: { include: { quota: true } } },
          },
        },
      },
      departmentMembers: {
        include: {
          department: {
            include: {
              quotaDepartments: {
                include: {
                  quota: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const historyRecords: {
    userId: bigint;
    workspaceGroupId: number;
    periodStart: Date;
    periodEnd: Date;
    minutes: number;
    messages: number;
    sessionsHosted: number;
    sessionsAttended: number;
    idleTime: number;
    wallPosts: number;
    quotaProgress: any;
  }[] = [];

  for (const member of workspaceMembers) {
    const userId = member.userId;
    const sessions = await prisma.activitySession.findMany({
      where: {
        userId,
        workspaceGroupId,
        endTime: { not: null },
        archived: { not: true },
      },
    });

    let sessionMinutes = 0;
    let totalMessages = 0;
    let totalIdleTime = 0;

    sessions.forEach((session) => {
      if (session.endTime) {
        const duration = Math.round(
          (session.endTime.getTime() - session.startTime.getTime()) / 60000
        );
        sessionMinutes += duration;
      }
      totalMessages += session.messages || 0;
      totalIdleTime += Number(session.idleTime) || 0;
    });

    const adjustments = await prisma.activityAdjustment.findMany({
      where: { userId, workspaceGroupId, archived: { not: true } },
    });

    const adjustmentMinutes = adjustments.reduce(
      (sum, adj) => sum + adj.minutes,
      0
    );
    const totalMinutes = sessionMinutes + adjustmentMinutes;

    const ownedSessions = await prisma.session.findMany({
      where: {
        ownerId: userId,
        sessionType: { workspaceGroupId },
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
        archived: { not: true },
      },
    });

    const allSessionParticipations = await prisma.sessionUser.findMany({
      where: {
        userid: userId,
        session: {
          sessionType: { workspaceGroupId },
          date: {
            gte: periodStart,
            lte: periodEnd,
          },
          archived: { not: true },
        },
      },
    });

    const wallPosts = await prisma.wallPost.findMany({
      where: {
        authorId: userId,
        workspaceGroupId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const quotaProgress: any = {};
    const userRoles = member.user.roles;
    const allQuotas: any[] = [];
    
    for (const role of userRoles) {
      for (const quotaRole of role.quotaRoles) {
        const quota = quotaRole.quota;
        if (!quotaProgress[quota.id]) {
          allQuotas.push(quota);
          quotaProgress[quota.id] = {
            quotaId: quota.id,
            quotaName: quota.name,
            quotaType: quota.type,
            targetMinutes: quota.value,
            currentMinutes: 0,
            completed: false,
          };
        }
      }
    }

    for (const departmentMember of member.departmentMembers) {
      for (const quotaDepartment of departmentMember.department.quotaDepartments) {
        const quota = quotaDepartment.quota;
        if (!quotaProgress[quota.id]) {
          allQuotas.push(quota);
          quotaProgress[quota.id] = {
            quotaId: quota.id,
            quotaName: quota.name,
            quotaType: quota.type,
            targetMinutes: quota.value,
            currentMinutes: 0,
            completed: false,
          };
        }
      }
    }

    const quotaIds = allQuotas.map(q => q.id);
    const customQuotaCompletions = quotaIds.length > 0 ? await prisma.userQuotaCompletion.findMany({
      where: {
        quotaId: { in: quotaIds },
        userId,
        workspaceGroupId,
        archived: { not: true },
      },
      include: {
        completedByUser: {
          select: {
            userid: true,
            username: true,
          },
        },
      },
    }) : [];

    const completionMap = new Map();
    customQuotaCompletions.forEach(completion => {
      completionMap.set(completion.quotaId, completion);
    });

    for (const quotaId in quotaProgress) {
      const quota = allQuotas.find(q => q.id === quotaId);
      
      if (quota?.type === 'custom') {
        const completion = completionMap.get(quotaId);
        if (completion) {
          quotaProgress[quotaId].completed = completion.completed || false;
          quotaProgress[quotaId].completedAt = completion.completedAt;
          quotaProgress[quotaId].completedBy = completion.completedBy ? completion.completedBy.toString() : null;
          quotaProgress[quotaId].completedByUsername = completion.completedByUser?.username || null;
          quotaProgress[quotaId].completionNotes = completion.notes;
        }
      } else {
        quotaProgress[quotaId].currentMinutes = totalMinutes;
        quotaProgress[quotaId].completed =
          totalMinutes >= quotaProgress[quotaId].targetMinutes;
      }
    }

    const hasQuotas = Object.keys(quotaProgress).length > 0;
    const hasActivity = 
      totalMinutes > 0 ||
      totalMessages > 0 ||
      ownedSessions.length > 0 ||
      allSessionParticipations.length > 0 ||
      wallPosts.length > 0;

    if (hasActivity || hasQuotas) {
      historyRecords.push({
        userId,
        workspaceGroupId,
        periodStart,
        periodEnd,
        minutes: totalMinutes,
        messages: totalMessages,
        sessionsHosted: ownedSessions.length,
        sessionsAttended: allSessionParticipations.length,
        idleTime: totalIdleTime,
        wallPosts: wallPosts.length,
        quotaProgress,
      });
    }
  }

  await prisma.activityHistory.createMany({
    data: historyRecords,
  });

  await prisma.activityReset.create({
    data: {
      workspaceGroupId,
      resetAt: new Date(),
      previousPeriodStart: periodStart,
      previousPeriodEnd: periodEnd,
      resetById: undefined,
    },
  });

  await prisma.activitySession.updateMany({
    where: { 
      workspaceGroupId,
      archived: { not: true },
    },
    data: {
      archived: true,
      archiveStartDate: periodStart,
      archiveEndDate: periodEnd,
    },
  });

  await prisma.activityAdjustment.updateMany({
    where: { 
      workspaceGroupId,
      archived: { not: true },
    },
    data: {
      archived: true,
      archiveStartDate: periodStart,
      archiveEndDate: periodEnd,
    },
  });

  await prisma.sessionUser.updateMany({
    where: {
      session: {
        sessionType: { workspaceGroupId },
        date: { lte: new Date() },
      },
      archived: { not: true },
    },
    data: {
      archived: true,
      archiveStartDate: periodStart,
      archiveEndDate: periodEnd,
    },
  });

  await prisma.session.updateMany({
    where: {
      sessionType: { workspaceGroupId },
      date: { lte: new Date() },
      archived: { not: true },
    },
    data: {
      archived: true,
      archiveStartDate: periodStart,
      archiveEndDate: periodEnd,
    },
  });

  await prisma.userQuotaCompletion.updateMany({
    where: {
      workspaceGroupId,
      archived: { not: true },
    },
    data: {
      archived: true,
      archiveStartDate: periodStart,
      archiveEndDate: periodEnd,
    },
  });
}
