import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { withPublicApiRateLimit } from "@/utils/prtl"
import { validateApiKey } from "@/utils/api-auth"

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" })

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })

  const { startDate, endDate, userId, limit: limitParam = "50", page: pageParam = "1" } = req.query
  const limit = Math.min(100, Math.max(1, Number.parseInt(limitParam as string) || 50))
  const page = Math.max(1, Number.parseInt(pageParam as string) || 1)
  const skip = (page - 1) * limit

  try {
    const key = await validateApiKey(apiKey, workspaceId)
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid or expired API key" })
    }

    // Build query filters
    const where: any = {
      workspaceGroupId: workspaceId,
    }

    if (userId) {
      where.userId = BigInt(userId as string)
    }

    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) where.startTime.gte = new Date(startDate as string)
      if (endDate) where.startTime.lte = new Date(endDate as string)
    }

    const queryWhere = { ...where, archived: { not: true } }
    const [sessions, totalCount] = await prisma.$transaction([
      prisma.activitySession.findMany({
        where: queryWhere,
        include: {
          user: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
        orderBy: {
          startTime: "desc",
        },
        take: limit,
        skip,
      }),
      prisma.activitySession.count({ where: queryWhere }),
    ])

    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      userId: Number(session.userId),
      username: session.user.username,
      active: session.active,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000) : null,
      messages: session.messages,
    }))

    return res.status(200).json({
      success: true,
      sessions: formattedSessions,
      total: totalCount,
      page,
      limit,
      pages: Math.ceil(totalCount / limit),
    })
  } catch (error) {
    console.error("Error in public API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
