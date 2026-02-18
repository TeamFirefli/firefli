// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { withSessionRoute } from "@/lib/withSession";
import {
  getUsername,
  getThumbnail,
  getDisplayName,
} from "@/utils/userinfoEngine";
import { getConfig } from "@/utils/configEngine";
import noblox from "noblox.js";

const activityUsersCache = new Map<string, { data: any; timestamp: number }>();
const ACTIVITY_CACHE_DURATION = 60000; // Increase from 30s to 60s
const ACTIVITY_STALE_DURATION = 300000; // 5 min stale-while-revalidate

// Add cache cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of activityUsersCache.entries()) {
    if (now - value.timestamp > ACTIVITY_STALE_DURATION) {
      activityUsersCache.delete(key);
    }
  }
}, 600000);

type Data = {
  success: boolean;
  message?: object;
  error?: string;
};
type CombinedObj = {
  userId: number;
  ms: number[];
};
type TopStaff = {
  userId: number;
  username: string;
  ms: number;
  picture: string;
};

export default withPermissionCheck(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  if (!req.session.userid)
    return res.status(401).json({ success: false, error: "Not logged in" });

  const workspaceId = parseInt(req.query.id as string);
  const cacheKey = `activity_users_${workspaceId}`;
  const now = Date.now();
  const cached = activityUsersCache.get(cacheKey);
  if (cached) {
    const age = now - cached.timestamp;

    // Return fresh cache immediately
    if (age < ACTIVITY_CACHE_DURATION) {
      return res.status(200).json({ success: true, message: cached.data });
    }

    // Return stale data, refresh in background (stale-while-revalidate)
    if (age < ACTIVITY_STALE_DURATION) {
      res.status(200).json({ success: true, message: cached.data });

      // Refresh in background (non-blocking)
      setImmediate(async () => {
        try {
          const freshData = await fetchActivityData(workspaceId);
          activityUsersCache.set(cacheKey, {
            data: freshData,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('[activity/users] Background refresh failed:', error);
        }
      });
      return;
    }
  }

  const [lastReset, activityConfig, robloxRoles] = await Promise.all([
    prisma.activityReset.findFirst({
      where: { workspaceGroupId: workspaceId },
      orderBy: { resetAt: "desc" },
    }),
    getConfig("activity", workspaceId),
    noblox.getRoles(workspaceId).catch(() => [])
  ]);

  const startDate = lastReset?.resetAt || new Date("2025-01-01");
  const currentDate = new Date();
  const leaderboardRankNum = activityConfig?.leaderboardRole ?? (activityConfig as any)?.lRole;
  const idleTimeEnabled = activityConfig?.idleTimeEnabled ?? true;
  const roleIdToRankNum = new Map<number, number>();
  for (const role of robloxRoles) {
    roleIdToRankNum.set(role.id, role.rank);
  }

  // Parallel queries for all session and user data
  const [sessions, activeSession, inactiveSession, users] = await Promise.all([
    prisma.activitySession.findMany({
      where: {
        workspaceGroupId: workspaceId,
        startTime: { gte: startDate, lte: currentDate },
        archived: { not: true }
      }
    }),
    prisma.activitySession.findMany({
      where: {
        active: true,
        workspaceGroupId: workspaceId,
        archived: { not: true }
      },
      select: { userId: true }
    }),
    prisma.inactivityNotice.findMany({
      where: {
        endTime: { gt: currentDate },
        startTime: { lt: currentDate },
        workspaceGroupId: workspaceId,
        approved: true,
        reviewed: true
      },
      select: { userId: true, reason: true, startTime: true, endTime: true }
    }),
    prisma.user.findMany({
      where: {
        ranks: {
          some: {
            workspaceGroupId: workspaceId
          }
        }
      },
      select: {
        userid: true,
        username: true,
        picture: true,
        ranks: {
          where: { workspaceGroupId: workspaceId },
          select: { rankId: true }
        }
      }
    })
  ]);

  // Users already fetched in parallel above

  var activeUsers: {
    userId: number;
    username: string;
    picture: string;
  }[] = [];
  var inactiveUsers: {
    userId: number;
    username: string;
    reason: string;
    from: Date;
    to: Date;
    picture: string;
  }[] = [];

  for (const user of activeSession) {
    const u = users.find((u) => u.userid === user.userId);
    activeUsers.push({
      userId: Number(user.userId),
      username: u?.username || "Unknown",
      picture: getThumbnail(user.userId),
    });
  }
  for (const session of inactiveSession) {
    const u = users.find((u) => u.userid === session.userId);
    inactiveUsers.push({
      userId: Number(session.userId),
      reason: session.reason,
      from: session.startTime,
      to: session.endTime!,
      username: u?.username || "Unknown",
      picture: getThumbnail(session.userId),
    });
  }

  activeUsers = activeUsers.filter((v, i, a) => a.indexOf(v) == i);
  inactiveUsers = inactiveUsers.filter((v, i, a) => a.indexOf(v) == i);

  inactiveUsers = inactiveUsers.filter((x) => {
    if (activeUsers.find((y) => x == y)) return false;
    return true;
  });

  const combinedMinutes: CombinedObj[] = [];
  sessions.forEach((session) => {
    if (!session.endTime) return;
    const found = combinedMinutes.find(
      (x) => x.userId == Number(session.userId)
    );
    const sessionDuration =
      session.endTime.getTime() - session.startTime.getTime();
    const idleTimeMs =
      idleTimeEnabled && session.idleTime
        ? Number(session.idleTime) * 60000
        : 0;
    const effectiveTime = sessionDuration - idleTimeMs;

    if (found) {
      found.ms.push(effectiveTime);
    } else {
      combinedMinutes.push({
        userId: Number(session.userId),
        ms: [effectiveTime],
      });
    }
  });

  const adjustments = await prisma.activityAdjustment.findMany({
    where: {
      workspaceGroupId: workspaceId,
      createdAt: {
        gte: startDate,
        lte: currentDate,
      },
      archived: { not: true },
    },
  });
  adjustments.forEach((adjustment: any) => {
    const found = combinedMinutes.find(
      (x) => x.userId == Number(adjustment.userId)
    );
    const adjustmentMs = adjustment.minutes * 60000;
    if (found) {
      found.ms.push(adjustmentMs);
    } else {
      combinedMinutes.push({
        userId: Number(adjustment.userId),
        ms: [adjustmentMs],
      });
    }
  });

  const topStaff: TopStaff[] = [];
  const processedUserIds = new Set<number>();
  for (const min of combinedMinutes) {
    const minSum = min.ms.reduce((partial, a) => partial + a, 0);
    const found = users.find((x) => x.userid === BigInt(min.userId));
    if (leaderboardRankNum !== undefined && found) {
      const userRoleId = (found as any).ranks?.[0]?.rankId;
      const userRankNum = userRoleId ? roleIdToRankNum.get(Number(userRoleId)) : undefined;
      if (userRankNum === undefined || userRankNum < leaderboardRankNum) {
        continue;
      }
    }

    if (found) {
      topStaff.push({
        userId: min.userId,
        username: found?.username || "Unknown",
        ms: minSum,
        picture: getThumbnail(found.userid),
      });
      processedUserIds.add(min.userId);
    }
  }
  for (const user of users) {
    const userId = Number(user.userid);
    if (processedUserIds.has(userId)) continue;

    if (leaderboardRankNum !== undefined) {
      const userRoleId = (user as any).ranks?.[0]?.rankId;
      const userRankNum = userRoleId ? roleIdToRankNum.get(Number(userRoleId)) : undefined;
      if (userRankNum === undefined || userRankNum < leaderboardRankNum) {
        continue;
      }
    }

    topStaff.push({
      userId: userId,
      username: user.username || "Unknown",
      ms: 0,
      picture: getThumbnail(user.userid),
    });
  }

  const bestStaff = topStaff.sort((a, b) => {
    if (b.ms !== a.ms) {
      return b.ms - a.ms;
    }
    return a.username.localeCompare(b.username);
  });

  const responseData = { activeUsers, inactiveUsers, topStaff: bestStaff };
  activityUsersCache.set(cacheKey, { data: responseData, timestamp: now });

  return res.status(200).json({ success: true, message: responseData });
}

// Helper function for background refresh
async function fetchActivityData(workspaceId: number) {
  const [lastReset, activityConfig, robloxRoles] = await Promise.all([
    prisma.activityReset.findFirst({
      where: { workspaceGroupId: workspaceId },
      orderBy: { resetAt: "desc" },
    }),
    getConfig("activity", workspaceId),
    noblox.getRoles(workspaceId).catch(() => [])
  ]);

  const startDate = lastReset?.resetAt || new Date("2025-01-01");
  const currentDate = new Date();
  const leaderboardRankNum = activityConfig?.leaderboardRole ?? (activityConfig as any)?.lRole;
  const idleTimeEnabled = activityConfig?.idleTimeEnabled ?? true;
  const roleIdToRankNum = new Map<number, number>();
  for (const role of robloxRoles) {
    roleIdToRankNum.set(role.id, role.rank);
  }

  const [sessions, activeSession, inactiveSession, users] = await Promise.all([
    prisma.activitySession.findMany({
      where: {
        workspaceGroupId: workspaceId,
        startTime: { gte: startDate, lte: currentDate },
        archived: { not: true }
      }
    }),
    prisma.activitySession.findMany({
      where: {
        active: true,
        workspaceGroupId: workspaceId,
        archived: { not: true }
      },
      select: { userId: true }
    }),
    prisma.inactivityNotice.findMany({
      where: {
        endTime: { gt: currentDate },
        startTime: { lt: currentDate },
        workspaceGroupId: workspaceId,
        approved: true,
        reviewed: true
      },
      select: { userId: true, reason: true, startTime: true, endTime: true }
    }),
    prisma.user.findMany({
      where: {
        ranks: {
          some: {
            workspaceGroupId: workspaceId
          }
        }
      },
      select: {
        userid: true,
        username: true,
        picture: true,
        ranks: {
          where: { workspaceGroupId: workspaceId },
          select: { rankId: true }
        }
      }
    })
  ]);

  const adjustments = await prisma.activityAdjustment.findMany({
    where: {
      workspaceGroupId: workspaceId,
      createdAt: { gte: startDate, lte: currentDate },
      archived: { not: true }
    }
  });

  // Process active users
  const activeUsers = activeSession.map((session) => {
    const u = users.find((u) => u.userid === session.userId);
    return {
      userId: Number(session.userId),
      username: u?.username || "Unknown",
      picture: getThumbnail(session.userId),
    };
  }).filter((v, i, a) => a.findIndex(t => t.userId === v.userId) === i);

  // Process inactive users
  let inactiveUsers = inactiveSession.map((session) => {
    const u = users.find((u) => u.userid === session.userId);
    return {
      userId: Number(session.userId),
      reason: session.reason,
      from: session.startTime,
      to: session.endTime!,
      username: u?.username || "Unknown",
      picture: getThumbnail(session.userId),
    };
  }).filter((v, i, a) => a.findIndex(t => t.userId === v.userId) === i);

  inactiveUsers = inactiveUsers.filter(
    (x) => !activeUsers.find((y) => x.userId === y.userId)
  );

  // Calculate combined minutes
  const combinedMinutes: CombinedObj[] = [];
  sessions.forEach((session) => {
    if (!session.endTime) return;
    const found = combinedMinutes.find(
      (x) => x.userId == Number(session.userId)
    );
    const sessionDuration =
      session.endTime.getTime() - session.startTime.getTime();
    const idleTimeMs =
      idleTimeEnabled && session.idleTime
        ? Number(session.idleTime) * 60000
        : 0;
    const effectiveTime = sessionDuration - idleTimeMs;

    if (found) {
      found.ms.push(effectiveTime);
    } else {
      combinedMinutes.push({
        userId: Number(session.userId),
        ms: [effectiveTime],
      });
    }
  });

  // Add adjustments
  adjustments.forEach((adjustment: any) => {
    const found = combinedMinutes.find(
      (x) => x.userId == Number(adjustment.userId)
    );
    const adjustmentMs = adjustment.minutes * 60000;
    if (found) {
      found.ms.push(adjustmentMs);
    } else {
      combinedMinutes.push({
        userId: Number(adjustment.userId),
        ms: [adjustmentMs],
      });
    }
  });

  // Build top staff
  const topStaff: TopStaff[] = [];
  const processedUserIds = new Set<number>();
  for (const min of combinedMinutes) {
    const minSum = min.ms.reduce((partial, a) => partial + a, 0);
    const found = users.find((x) => x.userid === BigInt(min.userId));
    if (leaderboardRankNum !== undefined && found) {
      const userRoleId = (found as any).ranks?.[0]?.rankId;
      const userRankNum = userRoleId ? roleIdToRankNum.get(Number(userRoleId)) : undefined;
      if (userRankNum === undefined || userRankNum < leaderboardRankNum) {
        continue;
      }
    }

    if (found) {
      topStaff.push({
        userId: min.userId,
        username: found?.username || "Unknown",
        ms: minSum,
        picture: getThumbnail(found.userid),
      });
      processedUserIds.add(min.userId);
    }
  }

  for (const user of users) {
    const userId = Number(user.userid);
    if (processedUserIds.has(userId)) continue;

    if (leaderboardRankNum !== undefined) {
      const userRoleId = (user as any).ranks?.[0]?.rankId;
      const userRankNum = userRoleId ? roleIdToRankNum.get(Number(userRoleId)) : undefined;
      if (userRankNum === undefined || userRankNum < leaderboardRankNum) {
        continue;
      }
    }

    topStaff.push({
      userId: userId,
      username: user.username || "Unknown",
      ms: 0,
      picture: getThumbnail(user.userid),
    });
  }

  const bestStaff = topStaff.sort((a, b) => {
    if (b.ms !== a.ms) {
      return b.ms - a.ms;
    }
    return a.username.localeCompare(b.username);
  });

  return { activeUsers, inactiveUsers, topStaff: bestStaff };
}