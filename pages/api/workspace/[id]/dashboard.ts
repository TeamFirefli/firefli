import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';
import { withPermissionCheck } from '@/utils/permissionsManager';
import { getConfig } from '@/utils/configEngine';

type DashboardData = {
  success: boolean;
  message?: {
    activityUsers?: any;
    wallPosts?: any;
    activeSessions?: any;
    docs?: any;
    newMembers?: any;
    upcomingBirthdays?: any;
  };
  error?: string;
};

const dashboardCache = new Map<string, { data: any; timestamp: number }>();
const DASHBOARD_CACHE_DURATION = 30000;

export default withPermissionCheck(handler);

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const workspaceId = parseInt(req.query.id as string);
  const userId = req.session.userid;
  const cacheKey = `dashboard_${workspaceId}_${userId}`;

  // Check cache
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);
  if (cached && now - cached.timestamp < DASHBOARD_CACHE_DURATION) {
    return res.status(200).json({ success: true, message: cached.data });
  }

  try {
    // Parse query params for enabled widgets
    const widgetsParam = (req.query.widgets as string) || '';
    const widgets = widgetsParam.split(',').filter(Boolean);
    const includeBirthdays = req.query.includeBirthdays === 'true';
    const includeNewMembers = req.query.includeNewMembers === 'true';

    // Fetch user permissions once
    const user = await prisma.user.findFirst({
      where: { userid: BigInt(userId!) },
      include: {
        roles: { where: { workspaceGroupId: workspaceId } },
        workspaceMemberships: { where: { workspaceGroupId: workspaceId } }
      }
    });

    if (!user?.roles?.length) {
      return res.status(403).json({
        success: false,
        error: 'No permission to view this workspace'
      });
    }

    const userRole = user.roles[0];
    const isAdmin = user.workspaceMemberships[0]?.isAdmin || false;
    const permissions = userRole.permissions;

    // Build parallel queries based on enabled widgets
    const queries: Promise<any>[] = [];
    const queryMap: Record<string, number> = {};
    let index = 0;

    // Wall posts (if enabled and has permission)
    if (widgets.includes('wall') && permissions.includes('view_wall')) {
      queryMap.wallPosts = index++;
      queries.push(
        prisma.wallPost.findMany({
          where: { workspaceGroupId: workspaceId },
          include: {
            author: { select: { username: true, picture: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      );
    }

    // Active sessions (if enabled)
    if (widgets.includes('sessions')) {
      queryMap.activeSessions = index++;
      const { startDate, endDate } = getTodayBounds(req.query);
      queries.push(
        prisma.session.findMany({
          where: {
            sessionType: { workspaceGroupId: workspaceId },
            date: { gte: startDate, lte: endDate }
          },
          include: {
            owner: { select: { username: true, picture: true, userid: true } },
            sessionType: { select: { name: true, statues: true } }
          },
          orderBy: { date: 'asc' }
        })
      );
    }

    // Documents (if enabled)
    if (widgets.includes('documents')) {
      queryMap.docs = index++;
      const hasDocsPermission =
        permissions.includes('create_docs') ||
        permissions.includes('edit_docs') ||
        permissions.includes('delete_docs') ||
        isAdmin;

      queries.push(
        prisma.document.findMany({
          where: {
            workspaceGroupId: workspaceId,
            isTrainingDocument: true,
            ...(hasDocsPermission ? {} : {
              roles: { some: { id: userRole.id } }
            })
          },
          include: {
            owner: { select: { username: true, picture: true } }
          },
          take: 10,
          orderBy: { updatedAt: 'desc' }
        })
      );
    }

    // New members (if enabled)
    if (includeNewMembers) {
      queryMap.newMembers = index++;
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      queries.push(
        prisma.workspaceMember.findMany({
          where: { workspaceGroupId: workspaceId, joinDate: { gte: cutoff } },
          include: { user: { select: { userid: true, username: true, picture: true } } },
          orderBy: { joinDate: 'desc' },
          take: 20
        })
      );
    }

    // Upcoming birthdays (if enabled)
    if (includeBirthdays) {
      queryMap.upcomingBirthdays = index++;
      queries.push(
        prisma.workspaceMember.findMany({
          where: {
            workspaceGroupId: workspaceId,
            user: {
              birthdayDay: { not: null },
              birthdayMonth: { not: null }
            }
          },
          include: {
            user: {
              select: {
                userid: true,
                username: true,
                picture: true,
                birthdayDay: true,
                birthdayMonth: true
              }
            }
          }
        })
      );
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries);

    // Build response object
    const dashboardData: any = {};

    if (queryMap.wallPosts !== undefined) {
      dashboardData.wallPosts = results[queryMap.wallPosts];
    }
    if (queryMap.activeSessions !== undefined) {
      const sessions = results[queryMap.activeSessions];
      dashboardData.activeSessions = processSessionStatus(sessions);
    }
    if (queryMap.docs !== undefined) {
      dashboardData.docs = results[queryMap.docs];
    }
    if (queryMap.newMembers !== undefined) {
      dashboardData.newMembers = results[queryMap.newMembers].map((m: any) => ({
        userid: m.user.userid.toString(),
        username: m.user.username || m.user.userid.toString(),
        picture: m.user.picture,
        joinDate: m.joinDate
      }));
    }
    if (queryMap.upcomingBirthdays !== undefined) {
      dashboardData.upcomingBirthdays = processBirthdays(
        results[queryMap.upcomingBirthdays]
      );
    }

    // Activity/notices widget - use optimized endpoint from Phase 2
    if (widgets.includes('notices')) {
      // Fetch from optimized /activity/users endpoint
      // This reuses the cache and optimizations from Phase 2
      dashboardData.activityUsers = await fetchActivityUsers(workspaceId);
    }

    // Serialize BigInt values
    const serialized = JSON.parse(
      JSON.stringify(dashboardData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    // Cache result
    dashboardCache.set(cacheKey, { data: serialized, timestamp: now });

    return res.status(200).json({ success: true, message: serialized });
  } catch (error) {
    console.error('[dashboard] Error fetching dashboard data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
}

// Helper functions
function getTodayBounds(query: any) {
  const { startDate, endDate } = query;

  if (startDate && endDate) {
    return {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  return { startDate: todayStart, endDate: todayEnd };
}

function processSessionStatus(sessions: any[]) {
  const now = new Date();
  const activeSessions = sessions.filter((s: any) => {
    const start = new Date(s.date);
    const end = new Date(start.getTime() + s.duration * 60000);
    return now >= start && now <= end;
  });
  const nextSession = sessions.find((s: any) => {
    return new Date(s.date) > now;
  });
  return { sessions: activeSessions, nextSession };
}

function processBirthdays(members: any[]) {
  const today = new Date();
  const todayY = today.getFullYear();

  return members
    .filter(m => m.user.birthdayDay && m.user.birthdayMonth)
    .map(m => {
      const month = m.user.birthdayMonth;
      const day = m.user.birthdayDay;
      let next = new Date(todayY, month - 1, day);
      if (next < new Date(todayY, today.getMonth(), today.getDate())) {
        next = new Date(todayY + 1, month - 1, day);
      }
      const daysAway = Math.round((next.getTime() - today.getTime()) / 86400000);
      return {
        userid: m.user.userid.toString(),
        username: m.user.username || m.user.userid.toString(),
        picture: m.user.picture,
        birthdayDay: m.user.birthdayDay,
        birthdayMonth: m.user.birthdayMonth,
        daysAway
      };
    })
    .filter(u => u.daysAway >= 0 && u.daysAway <= 7)
    .sort((a, b) => a.daysAway - b.daysAway);
}

async function fetchActivityUsers(workspaceId: number) {
  // Call the optimized activity/users endpoint internally
  // This reuses its cache and optimizations
  try {
    const response = await fetch(
      `http://localhost:${process.env.PORT || 3000}/api/workspace/${workspaceId}/activity/users`,
      { headers: { 'X-Internal-Request': 'true' } }
    );
    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error('[dashboard] Failed to fetch activity users:', error);
    return null;
  }
}
