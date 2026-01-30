import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" })

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  const userId = req.query.userId as string

  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })
  if (!userId) return res.status(400).json({ success: false, error: "Missing user ID" })

  try {
    // Validate API key
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    const { status, from, to } = req.query

    const where: any = {
      workspaceGroupId: workspaceId,
      userId: BigInt(userId),
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

    // Filter by date range
    if (from || to) {
      where.startTime = {}
      if (from) where.startTime.gte = new Date(from as string)
      if (to) where.startTime.lte = new Date(to as string)
    }

    const [notices, user] = await Promise.all([
      prisma.inactivityNotice.findMany({
        where,
        orderBy: {
          startTime: "desc",
        },
      }),
      prisma.user.findUnique({
        where: {
          userid: BigInt(userId),
        },
        select: {
          userid: true,
          username: true,
          picture: true,
        },
      }),
    ])

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" })
    }

    const formattedNotices = notices.map((notice) => ({
      id: notice.id,
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
      user: {
        userId: Number(user.userid),
        username: user.username,
        thumbnail: user.picture,
      },
      notices: formattedNotices,
      total: formattedNotices.length,
    })
  } catch (error) {
    console.error("Error in public notices API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}
