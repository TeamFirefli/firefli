import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';
import { withSessionRoute } from '@/lib/withSession';

export default withSessionRoute(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const workspaceId = parseInt(req.query.id as string, 10);
  if (!workspaceId) return res.status(400).json({ success: false, error: 'Invalid workspace id' });
  if (!req.session.userid) return res.status(401).json({ success: false, error: 'Not logged in' });

  const userId = req.session.userid;

  try {
    const profileData = await prisma.user.findFirst({
      where: { userid: BigInt(userId) },
      include: {
        roles: {
          where: { workspaceGroupId: workspaceId },
          include: { quotaRoles: { include: { quota: true } } },
        },
        workspaceMemberships: {
          where: { workspaceGroupId: workspaceId },
          include: {
            departmentMembers: {
              include: {
                department: {
                  include: { quotaDepartments: { include: { quota: true } } },
                },
              },
            },
          },
        },
      },
    });

    const lastReset = await prisma.activityReset.findFirst({
      where: { workspaceGroupId: workspaceId },
      orderBy: { resetAt: 'desc' },
    });
    const nov30 = new Date('2024-11-30T00:00:00Z');
    const startDate = lastReset?.resetAt
      ? lastReset.resetAt > nov30 ? lastReset.resetAt : nov30
      : nov30;
    const currentDate = new Date();
    const activitySessions = await prisma.activitySession.findMany({
      where: {
        userId: BigInt(userId),
        workspaceGroupId: workspaceId,
        archived: { not: true },
      },
      select: { startTime: true, endTime: true, messages: true, idleTime: true },
    });
    const adjustments = await prisma.activityAdjustment.findMany({
      where: {
        userId: BigInt(userId),
        workspaceGroupId: workspaceId,
        archived: { not: true },
      },
      select: { minutes: true },
    });
    const activityConfig = await prisma.config.findFirst({
      where: { workspaceGroupId: workspaceId, key: 'activity' },
    });
    let idleTimeEnabled = true;
    if (activityConfig?.value) {
      try {
        const val = typeof activityConfig.value === 'string'
          ? JSON.parse(activityConfig.value)
          : activityConfig.value;
        if (typeof val === 'object' && val !== null && 'idleTimeEnabled' in val) {
          idleTimeEnabled = (val as any).idleTimeEnabled ?? true;
        }
      } catch { /* raht */ }
    }

    let totalMinutes = 0;
    let totalIdleTime = 0;
    activitySessions.forEach((s: any) => {
      if (s.endTime) {
        totalMinutes += Math.round(
          (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000
        );
      }
      totalIdleTime += Number(s.idleTime) || 0;
    });
    totalMinutes += adjustments.reduce((sum: number, a: any) => sum + a.minutes, 0);
    const activeMinutes = idleTimeEnabled
      ? Math.max(0, totalMinutes - Math.round(totalIdleTime))
      : totalMinutes;
    const sessionParticipations = await prisma.sessionUser.findMany({
      where: {
        userid: BigInt(userId),
        session: {
          sessionType: { workspaceGroupId: workspaceId },
          date: { gte: startDate, lte: currentDate },
          archived: { not: true },
        },
        archived: { not: true },
      },
      include: {
        session: {
          select: {
            id: true,
            type: true,
            sessionType: { select: { slots: true } },
          },
        },
      },
    });
    const hostedByType: Record<string, number> = {};
    const secondaryByType: Record<string, number> = {};
    const attendedByType: Record<string, number> = {};
    const loggedByType: Record<string, number> = {};
    const seenSessionIds = new Set<string>();
    sessionParticipations.forEach((p: any) => {
      const slots = p.session.sessionType.slots as any[];
      const slot = slots.find((s: any) => s.id === p.roleID);
      const type = p.session.type || 'other';
      if (slot?.hostRole === 'primary') {
        hostedByType[type] = (hostedByType[type] || 0) + 1;
      } else if (slot?.hostRole === 'secondary') {
        secondaryByType[type] = (secondaryByType[type] || 0) + 1;
      } else {
        attendedByType[type] = (attendedByType[type] || 0) + 1;
      }
      if (!seenSessionIds.has(p.session.id)) {
        seenSessionIds.add(p.session.id);
        loggedByType[type] = (loggedByType[type] || 0) + 1;
      }
    });

    const sessionsHosted = Object.values(hostedByType).reduce((a, b) => a + b, 0);
    const sessionsSecondary = Object.values(secondaryByType).reduce((a, b) => a + b, 0);
    const sessionsAttended = Object.values(attendedByType).reduce((a, b) => a + b, 0);
    const totalSessionsLogged = seenSessionIds.size;
    const allianceVisits = await prisma.allyVisit.count({
      where: {
        OR: [
          { hostId: BigInt(userId) },
          { participants: { has: BigInt(userId) } },
        ],
        time: { gte: startDate },
      },
    });

    const userRoleIds = (profileData?.roles || []).map((r: any) => r.id);
    const userDeptIds = (profileData?.workspaceMemberships?.[0]?.departmentMembers || [])
      .map((dm: any) => dm.department.id);
    const myQuotas = await prisma.quota.findMany({
      where: {
        workspaceGroupId: workspaceId,
        OR: [
          { quotaRoles: { some: { roleId: { in: userRoleIds } } } },
          { quotaDepartments: { some: { departmentId: { in: userDeptIds } } } },
        ],
      },
      include: {
        quotaRoles: { include: { role: { select: { name: true, color: true } } } },
        quotaDepartments: { include: { department: { select: { name: true, color: true } } } },
        userQuotaCompletions: {
          where: { userId: BigInt(userId), workspaceGroupId: workspaceId },
          include: { completedByUser: { select: { userid: true, username: true } } },
        },
      },
    } as any);

    const myQuotasWithProgress = (myQuotas as any[]).map((quota: any) => {
      if (quota.type === 'custom') {
        const completion = quota.userQuotaCompletions?.[0];
        return {
          id: quota.id, name: quota.name, description: quota.description,
          type: quota.type, value: quota.value,
          currentValue: null,
          percentage: completion?.completed ? 100 : 0,
          completed: completion?.completed || false,
        };
      }
      let currentValue = 0;
      switch (quota.type) {
        case 'mins': currentValue = activeMinutes; break;
        case 'sessions_hosted':
          currentValue = quota.sessionType && quota.sessionType !== 'all'
            ? hostedByType[quota.sessionType] || 0 : sessionsHosted; break;
        case 'sessions_secondary_host':
          currentValue = quota.sessionType && quota.sessionType !== 'all'
            ? secondaryByType[quota.sessionType] || 0 : sessionsSecondary; break;
        case 'sessions_attended':
          currentValue = quota.sessionType && quota.sessionType !== 'all'
            ? attendedByType[quota.sessionType] || 0 : sessionsAttended; break;
        case 'sessions_logged':
          currentValue = quota.sessionType && quota.sessionType !== 'all'
            ? loggedByType[quota.sessionType] || 0 : totalSessionsLogged; break;
        case 'alliance_visits': currentValue = allianceVisits; break;
      }
      const percentage = quota.value ? Math.min(100, (currentValue / quota.value) * 100) : 0;
      return {
        id: quota.id, name: quota.name, description: quota.description,
        type: quota.type, value: quota.value,
        currentValue, percentage, completed: percentage >= 100,
      };
    });

    return res.status(200).json({
      success: true,
      quotas: JSON.parse(
        JSON.stringify(myQuotasWithProgress, (_k, v) =>
          typeof v === 'bigint' ? v.toString() : v
        )
      ),
    } as any);
  } catch (error) {
    console.error('Error fetching quota progress:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
