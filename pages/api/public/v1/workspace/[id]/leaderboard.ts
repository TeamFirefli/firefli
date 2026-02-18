import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"
import { getConfig } from "@/utils/configEngine"
import { withPublicApiRateLimit } from "@/utils/prtl"
import noblox from "noblox.js"

type LeaderboardEntry = {
  _id: string
  position: number
  total: number
  in_game: boolean
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" })

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })

  try {
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    const activityConfig = await getConfig("activity", workspaceId)
    const leaderboardRankNum = activityConfig?.leaderboardRole ?? (activityConfig as any)?.lRole
    const idleTimeEnabled = activityConfig?.idleTimeEnabled ?? true
    const robloxRoles = await noblox.getRoles(workspaceId).catch(() => [])
    const roleIdToRankNum = new Map<number, number>()
    for (const role of robloxRoles) {
      roleIdToRankNum.set(role.id, role.rank)
    }
    
    const lastReset = await prisma.activityReset.findFirst({
      where: { workspaceGroupId: workspaceId },
      orderBy: { resetAt: "desc" },
    })
    const startDate = lastReset?.resetAt || new Date("2025-01-01")
    const currentDate = new Date()
    const sessions = await prisma.activitySession.findMany({
      where: {
        workspaceGroupId: workspaceId,
        startTime: { gte: startDate, lte: currentDate },
        archived: { not: true },
        endTime: { not: null }
      },
      select: {
        userId: true,
        startTime: true,
        endTime: true,
        idleTime: true,
      }
    })

    const adjustments = await prisma.activityAdjustment.findMany({
      where: {
        workspaceGroupId: workspaceId,
        createdAt: {
          gte: startDate,
          lte: currentDate,
        },
        archived: { not: true },
      },
      select: {
        userId: true,
        minutes: true,
      }
    })

    const userIdsSet = new Set<bigint>()
    sessions.forEach(s => userIdsSet.add(s.userId))
    adjustments.forEach(a => userIdsSet.add(a.userId))
    const users = await prisma.user.findMany({
      where: {
        userid: { in: Array.from(userIdsSet) }
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

    const userPlaytime = new Map<number, number>()
    sessions.forEach((session) => {
      if (!session.endTime) return
      const userId = Number(session.userId)
      const sessionDuration = session.endTime.getTime() - session.startTime.getTime()
      const idleTimeMs = idleTimeEnabled && session.idleTime ? Number(session.idleTime) * 60000 : 0
      const effectiveTime = sessionDuration - idleTimeMs

      const current = userPlaytime.get(userId) || 0
      userPlaytime.set(userId, current + effectiveTime)
    })

    adjustments.forEach((adjustment: any) => {
      const userId = Number(adjustment.userId)
      const adjustmentMs = adjustment.minutes * 60000
      const current = userPlaytime.get(userId) || 0
      userPlaytime.set(userId, current + adjustmentMs)
    })

    const leaderboard: LeaderboardEntry[] = users
      .map(user => {
        const userId = Number(user.userid)
        if (leaderboardRankNum !== undefined) {
          const userRoleId = (user as any).ranks?.[0]?.rankId
          const userRankNum = userRoleId ? roleIdToRankNum.get(Number(userRoleId)) : undefined
          if (userRankNum === undefined || userRankNum < leaderboardRankNum) {
            return null
          }
        }

        const playtime = userPlaytime.get(userId) || 0

        return {
          _id: user.userid.toString(),
          position: 0,
          total: Math.floor(playtime / 1000),
          in_game: false
        }
      })
      .filter((entry): entry is LeaderboardEntry => entry !== null)
      .sort((a, b) => b.total - a.total)
      .map((user, index) => ({
        ...user,
        position: index + 1
      }))

    const activeSessions = await prisma.activitySession.findMany({
      where: {
        active: true,
        workspaceGroupId: workspaceId,
        archived: { not: true }
      },
      select: { userId: true }
    })

    const activeUserIds = new Set(activeSessions.map(s => s.userId.toString()))
    leaderboard.forEach(entry => {
      if (activeUserIds.has(entry._id)) {
        entry.in_game = true
      }
    })

    const top_three = leaderboard.slice(0, 3)
    const { userId } = req.query
    let you: LeaderboardEntry | null = null
    
    if (userId) {
      const userEntry = leaderboard.find(entry => entry._id === userId.toString())
      if (userEntry) {
        you = userEntry
      }
    }

    const sessionCounts = new Map<string, number>()
    const sessionData = await prisma.activitySession.findMany({
      where: {
        workspaceGroupId: workspaceId,
        startTime: { gte: startDate, lte: currentDate },
        archived: { not: true },
        endTime: { not: null },
        userId: { in: top_three.map(u => BigInt(u._id)) }
      },
      select: {
        userId: true,
      }
    })

    sessionData.forEach(session => {
      const userId = session.userId.toString()
      sessionCounts.set(userId, (sessionCounts.get(userId) || 0) + 1)
    })

    const sessions_top_three = top_three.map((user, index) => ({
      _id: user._id,
      position: index + 1,
      total: sessionCounts.get(user._id) || 0
    }))

    const response = {
      playtime: {
        top_three: top_three
      },
      ...(you && { you: you }),
      sessions: {
        top_three: sessions_top_three
      }
    }
    return res.status(200).json(response)
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
