import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })

  try {
    // Validate API key
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    // GET - List all notices
    if (req.method === "GET") {
      const { status, userId, from, to, limit = "50", offset = "0" } = req.query

      const where: any = {
        workspaceGroupId: workspaceId,
      }

      // Filter by status
      if (status === "pending") {
        where.reviewed = false
      } else if (status === "approved") {
        where.approved = true
        where.reviewed = true
      } else if (status === "rejected") {
        where.approved = false
        where.reviewed = true
      } else if (status === "active") {
        where.endTime = { gte: new Date() }
        where.revoked = false
      }

      // Filter by user
      if (userId) {
        where.userId = BigInt(userId as string)
      }

      // Filter by date range
      if (from || to) {
        where.startTime = {}
        if (from) where.startTime.gte = new Date(from as string)
        if (to) where.startTime.lte = new Date(to as string)
      }

      const [notices, total] = await Promise.all([
        prisma.inactivityNotice.findMany({
          where,
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
          take: Math.min(Number.parseInt(limit as string), 100),
          skip: Number.parseInt(offset as string),
        }),
        prisma.inactivityNotice.count({ where }),
      ])

      const formattedNotices = notices.map((notice) => ({
        id: notice.id,
        userId: Number(notice.userId),
        user: {
          userId: Number(notice.user.userid),
          username: notice.user.username,
          thumbnail: notice.user.picture,
        },
        startTime: notice.startTime,
        endTime: notice.endTime,
        reason: notice.reason,
        approved: notice.approved,
        reviewed: notice.reviewed,
        revoked: notice.revoked,
        reviewComment: notice.reviewComment,
      }))

      return res.status(200).json({
        success: true,
        notices: formattedNotices,
        total,
        limit: Number.parseInt(limit as string),
        offset: Number.parseInt(offset as string),
      })
    }

    // POST - Create notice
    if (req.method === "POST") {
      const { userId, startTime, endTime, reason } = req.body

      if (!userId || !startTime || !reason) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: userId, startTime, reason"
        })
      }

      const notice = await prisma.inactivityNotice.create({
        data: {
          userId: BigInt(userId),
          workspaceGroupId: workspaceId,
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : null,
          reason,
          approved: false,
          reviewed: false,
          revoked: false,
        },
        include: {
          user: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
      })

      return res.status(201).json({
        success: true,
        notice: {
          id: notice.id,
          userId: Number(notice.userId),
          user: {
            userId: Number(notice.user.userid),
            username: notice.user.username,
            thumbnail: notice.user.picture,
          },
          startTime: notice.startTime,
          endTime: notice.endTime,
          reason: notice.reason,
          approved: notice.approved,
          reviewed: notice.reviewed,
          revoked: notice.revoked,
        },
      })
    }

    return res.status(405).json({ success: false, error: "Method not allowed" })
  } catch (error) {
    console.error("Error in public notices API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}
