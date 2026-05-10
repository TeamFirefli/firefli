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

  const { since } = req.query
  if (!since || typeof since !== "string") {
    return res.status(400).json({ success: false, error: "Missing required query parameter: since" })
  }

  const sinceDate = new Date(since)
  if (isNaN(sinceDate.getTime())) {
    return res.status(400).json({ success: false, error: "Invalid since date — must be an ISO 8601 timestamp" })
  }

  try {
    const key = await validateApiKey(apiKey, workspaceId)
    if (!key) return res.status(401).json({ success: false, error: "Invalid or expired API key" })

    const cases = await prisma.moderationCase.findMany({
      where: {
        workspaceGroupId: BigInt(workspaceId),
        status: "open",
        createdAt: { gt: sinceDate },
      },
      select: {
        id: true,
        targetUserId: true,
        action: true,
        reason: true,
        isPermanent: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "asc" },
    })

    return res.status(200).json({
      success: true,
      data: cases.map((c) => ({
        id: c.id,
        userId: Number(c.targetUserId),
        action: c.action,
        reason: c.reason,
        isPermanent: c.isPermanent,
        expiresAt: c.expiresAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching live moderation punishments:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
