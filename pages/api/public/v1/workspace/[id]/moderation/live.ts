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

  const { since, placeId } = req.query;
  if (!since || typeof since !== "string") {
    return res
      .status(400)
      .json({
        success: false,
        error: "Missing required query parameter: since",
      });
  }

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Invalid since date — must be an ISO 8601 timestamp",
      });
  }

  try {
    const key = await validateApiKey(apiKey, workspaceId);
    if (!key)
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired API key" });

    const now = new Date();

    const filterPlaceId =
      placeId && typeof placeId === "string" ? BigInt(placeId) : null;

    const cases: any[] = await (prisma.moderationCase.findMany as any)({
      where: {
        workspaceGroupId: BigInt(workspaceId),
        status: "resolved",
        revokedAt: null,
        resolvedAt: { gt: sinceDate },
        action: {
          in: ["kick", "temp_ban", "perm_ban"],
        },
      },
      select: {
        id: true,
        targetUserId: true,
        action: true,
        reason: true,
        isPermanent: true,
        expiresAt: true,
        resolvedAt: true,
        placeIds: true,
      },
      orderBy: { resolvedAt: "asc" },
    });

    const banCases = cases.filter((c) =>
      ["temp_ban", "perm_ban"].includes(c.action || ""),
    );

    const activeBans = await prisma.playerBan.findMany({
      where: {
        workspaceGroupId: BigInt(workspaceId),
        active: true,
        userId: {
          in: banCases.map((c) => c.targetUserId),
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    const filteredCases = cases.filter((c) => {
      if (c.action === "kick") return true;

      if (c.action === "perm_ban") {
        return activeBans.some(
          (ban) => ban.userId === c.targetUserId && ban.expiresAt === null,
        );
      }

      if (c.action === "temp_ban") {
        return activeBans.some(
          (ban) =>
            ban.userId === c.targetUserId &&
            !!ban.expiresAt &&
            ban.expiresAt > now,
        );
      }

      return false;
    });

    return res.status(200).json({
      success: true,
      data: (filteredCases as any[])
        .filter((c) => {
          if (!filterPlaceId) return true;
          const ids: bigint[] = c.placeIds ?? [];
          return ids.length === 0 || ids.some((pid) => pid === filterPlaceId);
        })
        .map((c) => ({
          id: c.id,
          userId: Number(c.targetUserId),
          action: c.action,
          reason: c.reason,
          isPermanent: c.isPermanent,
          expiresAt: c.expiresAt,
          placeIds: (c.placeIds ?? []).map(String),
        })),
    });
  } catch (error) {
    console.error("Error fetching live moderation punishments:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export default withPublicApiRateLimit(handler);
