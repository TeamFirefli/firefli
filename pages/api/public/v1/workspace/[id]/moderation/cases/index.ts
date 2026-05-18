import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { withPublicApiRateLimit } from "@/utils/prtl"
import { validateApiKey } from "@/utils/api-auth"

const VALID_STATUSES = ["open", "resolved", "appealed", "archived"]
const VALID_ACTIONS = ["warning", "kick", "temp_ban", "perm_ban"]
const PAGE_SIZE = 20

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })

  try {
    const key = await validateApiKey(apiKey, workspaceId)
    if (!key) return res.status(401).json({ success: false, error: "Invalid or expired API key" })

    if (req.method === "GET") {
      const { page = "1", search, status, action, targetUserId } = req.query

      const pageNum = Math.max(1, parseInt(page as string) || 1)
      const skip = (pageNum - 1) * PAGE_SIZE

      const where: any = { workspaceGroupId: BigInt(workspaceId) }

      if (status) {
        if (!VALID_STATUSES.includes(status as string)) {
          return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(", ")}` })
        }
        where.status = status as string
      }
      if (action) {
        if (!VALID_ACTIONS.includes(action as string)) {
          return res.status(400).json({ success: false, error: `action must be one of: ${VALID_ACTIONS.join(", ")}` })
        }
        where.action = action as string
      }
      if (targetUserId) {
        const uid = Number(targetUserId)
        if (!Number.isInteger(uid) || uid <= 0) {
          return res.status(400).json({ success: false, error: "Invalid targetUserId" })
        }
        where.targetUserId = BigInt(uid)
      }
      if (search && typeof search === "string" && search.trim()) {
        where.OR = [
          { targetUsername: { contains: search.trim(), mode: "insensitive" } },
          { reason: { contains: search.trim(), mode: "insensitive" } },
        ]
      }

      const [cases, total] = await Promise.all([
        (prisma.moderationCase.findMany as any)({
          where,
          select: {
            id: true,
            targetUserId: true,
            targetUsername: true,
            createdBy: true,
            reason: true,
            status: true,
            action: true,
            isPermanent: true,
            expiresAt: true,
            createdAt: true,
            resolvedAt: true,
            revokedAt: true,
            placeIds: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: PAGE_SIZE,
        }) as Promise<any[]>,
        prisma.moderationCase.count({ where }),
      ])

      return res.status(200).json({
        success: true,
        data: {
          cases: cases.map((c) => ({
            ...c,
            targetUserId: Number(c.targetUserId),
            createdBy: Number(c.createdBy),
            placeIds: ((c as any).placeIds ?? []).map(String),
          })),
          pagination: {
            total,
            page: pageNum,
            limit: PAGE_SIZE,
            pages: Math.ceil(total / PAGE_SIZE),
          },
        },
      })
    }

    // POST — create a case

    const {
      targetUserId,
      targetUsername,
      authorUserId,
      reason,
      description,
      status = "open",
      action,
      publicNote,
      banDuration,
      expiresAt,
      placeIds,
    } = req.body

    if (!targetUserId || !authorUserId || !reason) {
      return res.status(400).json({
        success: false,
        error: "targetUserId, authorUserId, and reason are required",
      })
    }

    const targetId = Number(targetUserId)
    const authorId = Number(authorUserId)

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid targetUserId" })
    }
    if (!Number.isInteger(authorId) || authorId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid authorUserId" })
    }
    if (typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, error: "reason must be a non-empty string" })
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(", ")}` })
    }
    if (action && !VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ success: false, error: `action must be one of: ${VALID_ACTIONS.join(", ")}` })
    }

    if (action === "temp_ban" && !expiresAt) {
      return res.status(400).json({ success: false, error: "expiresAt is required for temporary bans" })
    }

    const finalIsPermanent = action === "perm_ban"
    let parsedExpiresAt: Date | null = null
    if (action === "temp_ban" && expiresAt) {
      parsedExpiresAt = new Date(expiresAt)
      if (isNaN(parsedExpiresAt.getTime())) {
        return res.status(400).json({ success: false, error: "Invalid expiresAt date" })
      }
    }

    const parsedPlaceIds: bigint[] = Array.isArray(placeIds)
      ? placeIds
          .map((id: any) => { try { return BigInt(id); } catch { return null; } })
          .filter((id: bigint | null): id is bigint => id !== null)
      : []

    // Ensure target and author users exist (they may be Roblox users not yet in the system)
    await Promise.all([
      prisma.user.upsert({
        where: { userid: BigInt(targetId) },
        update: targetUsername ? { username: String(targetUsername) } : {},
        create: { userid: BigInt(targetId), username: targetUsername ? String(targetUsername) : null },
      }),
      prisma.user.upsert({
        where: { userid: BigInt(authorId) },
        update: {},
        create: { userid: BigInt(authorId) },
      }),
    ])

    const moderationCase = await prisma.moderationCase.create({
      data: {
        workspaceGroupId: BigInt(workspaceId),
        targetUserId: BigInt(targetId),
        targetUsername: targetUsername ? String(targetUsername) : null,
        createdBy: BigInt(authorId),
        reason: reason.trim(),
        description: description ? String(description) : null,
        status,
        action: action ?? null,
        publicNote: publicNote ? String(publicNote) : null,
        banDuration: banDuration != null ? Number(banDuration) : null,
        isPermanent: finalIsPermanent,
        expiresAt: parsedExpiresAt,
        placeIds: parsedPlaceIds,
      },
    })

    await prisma.moderationLog.create({
      data: {
        workspaceGroupId: BigInt(workspaceId),
        actionBy: BigInt(authorId),
        action: "case_created_via_api",
        targetUser: BigInt(targetId),
        targetUsername: targetUsername ? String(targetUsername) : null,
        caseId: moderationCase.id,
        details: { reason: reason.trim(), status, action: action ?? null },
      },
    })

    return res.status(201).json({
      success: true,
      data: {
        id: moderationCase.id,
        targetUserId: Number(moderationCase.targetUserId),
        targetUsername: moderationCase.targetUsername,
        authorUserId: Number(moderationCase.createdBy),
        reason: moderationCase.reason,
        description: moderationCase.description,
        status: moderationCase.status,
        action: moderationCase.action,
        publicNote: moderationCase.publicNote,
        banDuration: moderationCase.banDuration,
        isPermanent: moderationCase.isPermanent,
        expiresAt: moderationCase.expiresAt,
        placeIds: ((moderationCase as any).placeIds ?? []).map(String),
        createdAt: moderationCase.createdAt,
      },
    })
  } catch (error) {
    console.error("Error handling moderation cases public API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
