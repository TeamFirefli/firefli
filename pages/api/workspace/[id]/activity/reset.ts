// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchworkspace, getConfig, setConfig } from "@/utils/configEngine";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";
import { withPermissionCheck } from "@/utils/permissionsManager";

import {
  getUsername,
  getThumbnail,
  getDisplayName,
} from "@/utils/userinfoEngine";
import * as noblox from "noblox.js";
type Data = {
  success: boolean;
  error?: string;
};

export default withPermissionCheck(handler, "reset_activity");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  if (!req.session.userid)
    return res.status(401).json({ success: false, error: "Not logged in" });

  const workspaceGroupId = Number(req.query.id as string);

  try {
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
    
    console.log(`[RESET] Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
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
    
    console.log(`[RESET] Found ${workspaceMembers.length} workspace members`);
    
    const quotas = await prisma.quota.findMany({
      where: { workspaceGroupId },
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
        where: { 
          userId, 
          workspaceGroupId,
          archived: { not: true },
        },
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
          },
          archived: { not: true },
        },
        include: {
          session: {
            select: {
              id: true,
              sessionType: {
                select: {
                  slots: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const roleBasedHostedSessions = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";
          return (
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("co-host")
          );
        }
      ).length;

      const sessionsHosted = ownedSessions.length + roleBasedHostedSessions;
      const ownedSessionIds = new Set(ownedSessions.map((s) => s.id));
      const sessionsAttended = allSessionParticipations.filter(
        (participation) => {
          const slots = participation.session.sessionType.slots as any[];
          const slotIndex = participation.slot;
          const slotName = slots[slotIndex]?.name || "";
          const isCoHost =
            participation.roleID.toLowerCase().includes("co-host") ||
            slotName.toLowerCase().includes("co-host");

          return !isCoHost && !ownedSessionIds.has(participation.sessionid);
        }
      ).length;

      const allUserSessionsIds = new Set([
        ...ownedSessions.map(s => s.id),
        ...allSessionParticipations.map(p => p.sessionid)
      ]);
      const sessionsLogged = allUserSessionsIds.size;
      const sessionsByType: Record<string, number> = {};
      const allUserSessions = [
        ...ownedSessions.map(s => ({ id: s.id, type: s.type })),
        ...allSessionParticipations.map(p => ({ 
          id: p.sessionid, 
          type: (p.session as any).type 
        }))
      ];
      const uniqueSessionsMap = new Map(allUserSessions.map(s => [s.id, s.type]));
      for (const [, sessionType] of uniqueSessionsMap) {
        const type = sessionType || 'other';
        sessionsByType[type] = (sessionsByType[type] || 0) + 1;
      }
      const cohostSessions = allSessionParticipations.filter((p) => {
        const slots = p.session.sessionType.slots as any[];
        const slotName = slots[p.slot]?.name || "";
        return p.roleID.toLowerCase().includes("co-host") || slotName.toLowerCase().includes("co-host");
      }).length;

      const allianceVisits = await prisma.allyVisit.count({
        where: {
          ally: {
            workspaceGroupId: workspaceGroupId,
          },
          time: {
            gte: periodStart,
            lte: periodEnd,
          },
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
      const totalWallPosts = wallPosts.length;

      const quotaProgress: any = {};
      const roleQuotas = member.user.roles
        .flatMap((role) => role.quotaRoles)
        .map((qr) => qr.quota);
      
      const departmentQuotas = member.departmentMembers
        .flatMap((dm) => dm.department.quotaDepartments)
        .map((qd) => qd.quota);

      const quotaMap = new Map();
      [...roleQuotas, ...departmentQuotas].forEach((quota) => {
        if (!quotaMap.has(quota.id)) {
          quotaMap.set(quota.id, quota);
        }
      });
      const userQuotas = Array.from(quotaMap.values());
      const quotaIds = userQuotas.map(q => q.id);
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

      for (const quota of userQuotas) {
        let currentValue = 0;
        let percentage = 0;
        let completed = false;
        let completedAt = null;
        let completedBy = null;
        let completedByUsername = null;
        let completionNotes = null;

        switch (quota.type) {
          case "custom":
            const completion = completionMap.get(quota.id);
            if (completion) {
              completed = completion.completed || false;
              completedAt = completion.completedAt;
              completedBy = completion.completedBy ? completion.completedBy.toString() : null;
              completedByUsername = completion.completedByUser?.username || null;
              completionNotes = completion.notes;
              percentage = completed ? 100 : 0;
              currentValue = completed ? 1 : 0;
            }
            break;
          case "mins":
            currentValue = totalMinutes;
            percentage = (totalMinutes / quota.value) * 100;
            break;
          case "sessions_hosted":
            if (quota.sessionType && quota.sessionType !== 'all') {
              currentValue = sessionsByType[quota.sessionType] || 0;
            } else {
              currentValue = sessionsHosted;
            }
            percentage = (currentValue / quota.value) * 100;
            break;
          case "sessions_attended":
            currentValue = sessionsAttended;
            percentage = (sessionsAttended / quota.value) * 100;
            break;
          case "sessions_logged":
            if (quota.sessionType && quota.sessionType !== 'all') {
              currentValue = sessionsByType[quota.sessionType] || 0;
            } else {
              currentValue = sessionsLogged;
            }
            percentage = (currentValue / quota.value) * 100;
            break;
          case "alliance_visits":
            currentValue = allianceVisits;
            percentage = (allianceVisits / quota.value) * 100;
            break;
        }

        quotaProgress[quota.id] = {
          value: currentValue,
          percentage: Math.min(percentage, 100),
          name: quota.name,
          type: quota.type,
          requirement: quota.value,
        };

        if (quota.type === "custom") {
          quotaProgress[quota.id].completed = completed;
          if (completedAt) quotaProgress[quota.id].completedAt = completedAt;
          if (completedBy) quotaProgress[quota.id].completedBy = completedBy;
          if (completedByUsername) quotaProgress[quota.id].completedByUsername = completedByUsername;
          if (completionNotes) quotaProgress[quota.id].completionNotes = completionNotes;
        }
      }

      const hasQuotas = userQuotas.length > 0;
      const hasActivity = 
        totalMinutes > 0 ||
        totalMessages > 0 ||
        sessionsHosted > 0 ||
        sessionsAttended > 0 ||
        totalWallPosts > 0;

      if (hasActivity || hasQuotas) {
        console.log(`[RESET] Saving history for user ${userId}: activity=${hasActivity}, quotas=${hasQuotas} (${userQuotas.length} quotas)`);
        historyRecords.push({
          userId,
          workspaceGroupId,
          periodStart,
          periodEnd,
          minutes: totalMinutes,
          messages: totalMessages,
          sessionsHosted,
          sessionsAttended,
          idleTime: Math.round(totalIdleTime / 60),
          wallPosts: totalWallPosts,
          quotaProgress,
        });
      } else {
        console.log(`[RESET] Skipping user ${userId}: no activity and no quotas`);
      }
    }
    
    console.log(`[RESET] Total history records to save: ${historyRecords.length}`);
    
    await prisma.$transaction(async (tx) => {
      if (historyRecords.length > 0) {
        console.log(`[RESET] Creating ${historyRecords.length} ActivityHistory records`);
        await tx.activityHistory.createMany({
          data: historyRecords,
        });
        console.log(`[RESET] History records created successfully`);
      } else {
        console.log(`[RESET] No history records to create`);
      }
      await tx.activityReset.create({
        data: {
          workspaceGroupId,
          resetById: req.session.userid,
          previousPeriodStart: periodStart,
          previousPeriodEnd: periodEnd,
        },
      });
      await tx.sessionUser.updateMany({
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
      
      await tx.activitySession.updateMany({
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
      
      await tx.activityAdjustment.updateMany({
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
      
      await tx.session.updateMany({
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

      await tx.userQuotaCompletion.updateMany({
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
    });

    console.log(`[RESET] Manual reset completed successfully for workspace ${workspaceGroupId}`);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[RESET] Error during manual reset for workspace ${workspaceGroupId}:`, error);
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
}
