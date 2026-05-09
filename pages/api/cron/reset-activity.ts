import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { getConfig } from "@/utils/configEngine";
import { getResetStart } from "@/utils/activityrest";

type ResetResult = {
  workspaceId: bigint;
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

          if (schedule.frequency === "weekly" && daysSinceLastAutoReset >= 6) {
            shouldReset = true;
          } else if (schedule.frequency === "biweekly" && daysSinceLastAutoReset >= 13) {
            shouldReset = true;
          } else if (schedule.frequency === "monthly" && daysSinceLastAutoReset >= 27) {
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

async function performReset(workspaceGroupId: bigint | number) {
  const periodStart = await getResetStart(workspaceGroupId);

  const periodEnd = new Date();
  const workspaceUsers = await prisma.user.findMany({
    where: {
      OR: [
        {
          roles: {
            some: { workspaceGroupId },
          },
        },
        {
          workspaceMemberships: {
            some: { workspaceGroupId },
          },
        },
      ],
    },
    include: {
      roles: {
        where: { workspaceGroupId },
        include: { quotaRoles: { include: { quota: true } } },
      },
      workspaceMemberships: {
        where: { workspaceGroupId },
        include: {
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
      },
    },
  });

  const historyRecords: {
    userId: bigint;
    workspaceGroupId: bigint | number;
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

  for (const user of workspaceUsers) {
    const userId = user.userid;
    const membership = user.workspaceMemberships[0];
    const departmentMembers = membership?.departmentMembers || [];
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
      include: {
        session: {
          select: {
            id: true,
            type: true,
            sessionType: {
              select: {
                slots: true,
              },
            },
          },
        },
      },
    });

    const sessionsHostedCount = allSessionParticipations.filter((participation) => {
      const sessionSlots = participation.session.sessionType.slots as any[];
      const matchingSlot = sessionSlots.find((s: any) => s.id === participation.roleID);
      return matchingSlot?.hostRole === "primary" || matchingSlot?.hostRole === "secondary";
    }).length;

    const sessionsPrimaryHostedCount = allSessionParticipations.filter((participation) => {
      const sessionSlots = participation.session.sessionType.slots as any[];
      const matchingSlot = sessionSlots.find((s: any) => s.id === participation.roleID);
      return matchingSlot?.hostRole === "primary";
    }).length;

    const sessionsSecondaryHostedCount = allSessionParticipations.filter((participation) => {
      const sessionSlots = participation.session.sessionType.slots as any[];
      const matchingSlot = sessionSlots.find((s: any) => s.id === participation.roleID);
      return matchingSlot?.hostRole === "secondary";
    }).length;

    const sessionsAttendedCount = allSessionParticipations.filter((participation) => {
      const sessionSlots = participation.session.sessionType.slots as any[];
      const matchingSlot = sessionSlots.find((s: any) => s.id === participation.roleID);
      return !matchingSlot?.hostRole;
    }).length;

    const sessionsLoggedCount = new Set(allSessionParticipations.map(p => p.sessionid)).size;

    const sessionsByType: Record<string, number> = {};
    const secondaryHostedByType: Record<string, number> = {};
    for (const p of allSessionParticipations) {
      const sessionType = (p.session as any).type || 'other';
      sessionsByType[sessionType] = (sessionsByType[sessionType] || 0) + 1;
      const pSlots = (p.session as any)?.sessionType?.slots as any[] || [];
      const pSlot = pSlots.find((s: any) => s.id === p.roleID);
      if (pSlot?.hostRole === "secondary") {
        secondaryHostedByType[sessionType] = (secondaryHostedByType[sessionType] || 0) + 1;
      }
    }

    const allianceVisitsCount = await prisma.allyVisit.count({
      where: {
        ally: { workspaceGroupId },
        time: { gte: periodStart, lte: periodEnd },
        OR: [
          { hostId: userId },
          { participants: { has: userId } }
        ]
      }
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
    const userRoles = user.roles;
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
            completionType: (quota as any).completionType || null,
            linkedVia: "role",
            linkedName: role.name,
            linkedColor: role.color,
          };
        }
      }
    }

    for (const departmentMember of departmentMembers) {
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
            completionType: (quota as any).completionType || null,
            linkedVia: "department",
            linkedName: departmentMember.department.name,
            linkedColor: departmentMember.department.color,
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
        quotaProgress[quotaId].percentage = quotaProgress[quotaId].completed ? 100 : 0;
        quotaProgress[quotaId].value = quotaProgress[quotaId].completed ? 1 : 0;
        quotaProgress[quotaId].currentMinutes = quotaProgress[quotaId].value;
      } else {
        const requirement = quotaProgress[quotaId].targetMinutes;
        let currentValue = 0;
        let percentage = 0;
        switch (quota?.type) {
          case 'mins':
            currentValue = totalMinutes;
            percentage = requirement > 0 ? (totalMinutes / requirement) * 100 : 0;
            break;
          case 'sessions_hosted':
            currentValue = quota.sessionType && quota.sessionType !== 'all'
              ? sessionsByType[quota.sessionType] || 0
              : sessionsPrimaryHostedCount;
            percentage = requirement > 0 ? (currentValue / requirement) * 100 : 0;
            break;
          case 'sessions_secondary_host':
            currentValue = quota.sessionType && quota.sessionType !== 'all'
              ? secondaryHostedByType[quota.sessionType] || 0
              : sessionsSecondaryHostedCount;
            percentage = requirement > 0 ? (currentValue / requirement) * 100 : 0;
            break;
          case 'sessions_attended':
            currentValue = sessionsAttendedCount;
            percentage = requirement > 0 ? (currentValue / requirement) * 100 : 0;
            break;
          case 'sessions_logged':
            currentValue = quota.sessionType && quota.sessionType !== 'all'
              ? sessionsByType[quota.sessionType] || 0
              : sessionsLoggedCount;
            percentage = requirement > 0 ? (currentValue / requirement) * 100 : 0;
            break;
          case 'alliance_visits':
            currentValue = allianceVisitsCount;
            percentage = requirement > 0 ? (currentValue / requirement) * 100 : 0;
            break;
          default:
            currentValue = 0;
            percentage = 0;
        }
        quotaProgress[quotaId].currentMinutes = currentValue;
        quotaProgress[quotaId].value = currentValue;
        quotaProgress[quotaId].percentage = percentage;
        quotaProgress[quotaId].completed = percentage >= 100;
      }
    }

    const hasQuotas = Object.keys(quotaProgress).length > 0;
    const hasActivity = 
      totalMinutes > 0 ||
      totalMessages > 0 ||
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
        sessionsHosted: sessionsHostedCount,
        sessionsAttended: sessionsAttendedCount,
        idleTime: totalIdleTime,
        wallPosts: wallPosts.length,
        quotaProgress,
      });
    }
  }

  await prisma.activityHistory.createMany({
    data: historyRecords,
  });

  const resetRecord = await prisma.activityReset.create({
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

  await (prisma as any).userQuotaCompletion.updateMany({
    where: {
      workspaceGroupId,
      archived: { not: true },
    },
    data: {
      archived: true,
      archiveCycleId: resetRecord.id,
      archiveStartDate: periodStart,
      archiveEndDate: periodEnd,
    },
  });
}
