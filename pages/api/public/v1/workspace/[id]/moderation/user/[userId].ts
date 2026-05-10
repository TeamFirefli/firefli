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

  const rawUserId = req.query.userId ?? req.query.userid
  const targetUserId = Number.parseInt(rawUserId as string)
  if (!targetUserId || targetUserId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid userId" })
  }

  try {
    const key = await validateApiKey(apiKey, workspaceId)
    if (!key) return res.status(401).json({ success: false, error: "Invalid or expired API key" })

    const { current, startDate, endDate } = req.query

    const where: any = {
      workspaceGroupId: BigInt(workspaceId),
      targetUserId: BigInt(targetUserId),
    }

    if (current === "true") {
      where.status = "open"
      where.revokedAt = null
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ]
    } else if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        const start = new Date(startDate as string)
        if (isNaN(start.getTime())) {
          return res.status(400).json({ success: false, error: "Invalid startDate" })
        }
        where.createdAt.gte = start
      }
      if (endDate) {
        const end = new Date(endDate as string)
        if (isNaN(end.getTime())) {
          return res.status(400).json({ success: false, error: "Invalid endDate" })
        }
        where.createdAt.lte = end
      }
    }

    const cases = await prisma.moderationCase.findMany({
      where,
      select: {
        id: true,
        targetUserId: true,
        targetUsername: true,
        createdBy: true,
        reason: true,
        description: true,
        status: true,
        action: true,
        publicNote: true,
        banDuration: true,
        isPermanent: true,
        expiresAt: true,
        createdAt: true,
        resolvedAt: true,
        revokedAt: true,
        revokeReason: true,
        createdByUser: {
          select: {
            userid: true,
            username: true,
          },
        },
        revokedByUser: {
          select: {
            userid: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    const formatted = cases.map((c) => ({
      id: c.id,
      targetUserId: Number(c.targetUserId),
      targetUsername: c.targetUsername,
      author: {
        userId: Number(c.createdByUser?.userid ?? c.createdBy),
        username: c.createdByUser?.username ?? null,
      },
      reason: c.reason,
      description: c.description,
      status: c.status,
      action: c.action,
      publicNote: c.publicNote,
      banDuration: c.banDuration,
      isPermanent: c.isPermanent,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt,
      revoked: c.revokedAt
        ? {
            at: c.revokedAt,
            reason: c.revokeReason,
            by: c.revokedByUser
              ? {
                  userId: Number(c.revokedByUser.userid),
                  username: c.revokedByUser.username,
                }
              : null,
          }
        : null,
    }))

    return res.status(200).json({
      success: true,
      data: {
        userId: targetUserId,
        total: formatted.length,
        cases: formatted,
      },
    })
  } catch (error) {
    console.error("Error fetching case history via public API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
