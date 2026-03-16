import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"
import { withPublicApiRateLimit } from "@/utils/prtl"

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })

  try {
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    if (req.method === "GET") {
      const { status, targetUserId, createdById, limit = "50", offset = "0", sortBy = "createdAt", sortOrder = "desc" } = req.query
      const where: any = {
        workspaceGroupId: workspaceId,
      }

      if (status) {
        where.status = status
      }

      if (targetUserId) {
        where.targetUserId = BigInt(targetUserId as string)
      }

      if (createdById) {
        where.createdById = BigInt(createdById as string)
      }

      const orderBy: any = {}
      if (sortBy === "createdAt" || sortBy === "updatedAt") {
        orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc"
      } else {
        orderBy.createdAt = "desc"
      }

      const [recommendations, total] = await Promise.all([
        prisma.recommendation.findMany({
          where,
          include: {
            votes: {
              select: {
                userId: true,
                createdAt: true,
              },
            },
            comments: {
              select: {
                id: true,
              },
            },
          },
          orderBy,
          take: Math.min(Number.parseInt(limit as string), 100),
          skip: Number.parseInt(offset as string),
        }),
        prisma.recommendation.count({ where }),
      ])

      const formattedRecommendations = recommendations.map((rec) => ({
        id: rec.id,
        targetUserId: Number(rec.targetUserId),
        targetUsername: rec.targetUsername,
        targetPicture: rec.targetPicture,
        reason: rec.reason,
        status: rec.status,
        createdById: Number(rec.createdById),
        createdByName: rec.createdByName,
        editedById: rec.editedById ? Number(rec.editedById) : null,
        editedByName: rec.editedByName,
        editedAt: rec.editedAt,
        statusChangedById: rec.statusChangedById ? Number(rec.statusChangedById) : null,
        statusChangedByName: rec.statusChangedByName,
        statusChangedAt: rec.statusChangedAt,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        voteCount: rec.votes.length,
        votes: rec.votes.map(v => ({
          userId: Number(v.userId),
          createdAt: v.createdAt,
        })),
        commentCount: rec.comments.length,
      }))

      return res.status(200).json({
        success: true,
        recommendations: formattedRecommendations,
        total,
        limit: Number.parseInt(limit as string),
        offset: Number.parseInt(offset as string),
      })
    }

    if (req.method === "POST") {
      const { targetUserId, targetUsername, targetPicture, reason, createdById, createdByName } = req.body

      if (!targetUserId || !targetUsername || !reason || !createdById) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: targetUserId, targetUsername, reason, createdById"
        })
      }

      const existingRecommendation = await prisma.recommendation.findFirst({
        where: {
          workspaceGroupId: workspaceId,
          targetUserId: BigInt(targetUserId),
          status: {
            not: "archived",
          },
        },
      })

      if (existingRecommendation) {
        return res.status(409).json({
          success: false,
          error: "This user already has an active recommendation. Archive or delete it before creating a new one",
        })
      }

      const recommendation = await prisma.recommendation.create({
        data: {
          workspaceGroupId: workspaceId,
          targetUserId: BigInt(targetUserId),
          targetUsername,
          targetPicture: targetPicture || null,
          reason,
          createdById: BigInt(createdById),
          createdByName: createdByName || null,
          status: "active",
        },
        include: {
          votes: {
            select: {
              userId: true,
              createdAt: true,
            },
          },
          comments: {
            select: {
              id: true,
            },
          },
        },
      })

      return res.status(201).json({
        success: true,
        recommendation: {
          id: recommendation.id,
          targetUserId: Number(recommendation.targetUserId),
          targetUsername: recommendation.targetUsername,
          targetPicture: recommendation.targetPicture,
          reason: recommendation.reason,
          status: recommendation.status,
          createdById: Number(recommendation.createdById),
          createdByName: recommendation.createdByName,
          createdAt: recommendation.createdAt,
          updatedAt: recommendation.updatedAt,
          voteCount: 0,
          votes: [],
          commentCount: 0,
        },
      })
    }

    return res.status(405).json({ success: false, error: "Method not allowed" })
  } catch (error) {
    console.error("Error in public recommendations API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
