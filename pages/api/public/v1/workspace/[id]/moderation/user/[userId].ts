import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPublicApiRateLimit } from "@/utils/prtl";
import { validateApiKey } from "@/utils/api-auth";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey)
    return res.status(401).json({ success: false, error: "Missing API key" });

  const workspaceId = Number.parseInt(req.query.id as string);
  if (!workspaceId)
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });

  const rawUserId = req.query.userId ?? req.query.userid;
  const targetUserId = Number.parseInt(rawUserId as string);
  if (!targetUserId || targetUserId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid userId" });
  }

  try {
    const key = await validateApiKey(apiKey, workspaceId);
    if (!key)
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired API key" });

    const { current, startDate, endDate } = req.query;
    const now = new Date();
    const where: any = {
      workspaceGroupId: BigInt(workspaceId),
      targetUserId: BigInt(targetUserId),
    };

    if (current === "true") {
      where.revokedAt = null;
      where.status = "resolved";
      where.action = {
        in: ["perm_ban", "temp_ban"],
      };
      where.OR = [{ isPermanent: true }, { expiresAt: { gt: new Date() } }];
    }

    const cases: any[] = await (prisma.moderationCase.findMany as any)({
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
        placeIds: true,
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
    });

    const activeBans = await prisma.playerBan.findMany({
      where: {
        workspaceGroupId: BigInt(workspaceId),
        userId: BigInt(targetUserId),
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    });

    const filteredCases =
      current === "true"
        ? cases.filter((c) => {
            if (c.revokedAt) return false;
            if (c.status !== "resolved") return false;
            if (!["temp_ban", "perm_ban"].includes(c.action || ""))
              return false;

            return activeBans.some((ban) => {
              if (ban.userId !== c.targetUserId) return false;

              if (c.action === "perm_ban") {
                return ban.expiresAt === null;
              }

              if (c.action === "temp_ban") {
                return !!ban.expiresAt && ban.expiresAt > now;
              }

              return false;
            });
          })
        : cases;

    const formatted = filteredCases.map((c) => ({
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
      placeIds: ((c as any).placeIds ?? []).map(String),
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
    }));

    return res.status(200).json({
      success: true,
      data: {
        userId: targetUserId,
        total: formatted.length,
        cases: formatted,
      },
    });
  } catch (error) {
    console.error("Error fetching case history via public API:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export default withPublicApiRateLimit(handler);
