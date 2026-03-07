import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { validateApiKey } from "@/utils/api-auth";
import { withPublicApiRateLimit } from "@/utils/prtl";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey)
    return res.status(401).json({ success: false, error: "Missing API key" });

  const workspaceId = Number.parseInt(req.query.id as string);
  if (!workspaceId)
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });

  try {
    const key = await validateApiKey(apiKey, workspaceId);
    if (!key) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired API key" });
    }

    const {
      userId,
      type,
      limit = "50",
      offset = "0",
      includeRedacted = "false",
    } = req.query;

    const parsedLimit = Math.min(Math.max(1, Number.parseInt(String(limit))), 100);
    const parsedOffset = Math.max(0, Number.parseInt(String(offset)));

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({
        success: false,
        error: "limit and offset must be valid numbers",
      });
    }

    const where: any = {
      workspaceGroupId: workspaceId,
    };

    if (userId) {
      const numericUserId = Number.parseInt(String(userId));
      if (isNaN(numericUserId)) {
        return res
          .status(400)
          .json({ success: false, error: "userId must be a valid number" });
      }
      where.userId = BigInt(numericUserId);
    }

    if (type) {
      const validTypes = [
        "warning",
        "promotion",
        "demotion",
        "termination",
        "rank-change",
        "resignation",
        "note",
      ];
      if (validTypes.includes(String(type))) {
        where.type = String(type);
      } else {
        return res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        });
      }
    }

    if (String(includeRedacted).toLowerCase() !== "true") {
      where.redacted = false;
    }

    const [entries, totalCount] = await Promise.all([
      prisma.userBook.findMany({
        where,
        include: {
          admin: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
          user: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: parsedLimit,
        skip: parsedOffset,
      }),
      prisma.userBook.count({ where }),
    ]);

    const transformedEntries = entries.map((entry) => ({
      id: entry.id,
      userId: entry.userId.toString(),
      type: entry.type,
      reason: entry.reason,
      adminId: entry.adminId.toString(),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      workspaceGroupId: entry.workspaceGroupId,
      rankAfter: entry.rankAfter,
      rankBefore: entry.rankBefore,
      rankNameAfter: entry.rankNameAfter,
      rankNameBefore: entry.rankNameBefore,
      redacted: entry.redacted || false,
      redactedAt: entry.redactedAt?.toISOString() || null,
      redactedBy: entry.redactedBy?.toString() || null,
      admin: {
        userid: entry.admin.userid.toString(),
        username: entry.admin.username,
        picture: entry.admin.picture,
      },
      user: {
        userid: entry.user.userid.toString(),
        username: entry.user.username,
        picture: entry.user.picture,
      },
    }));

    return res.status(200).json({
      success: true,
      entries: transformedEntries,
      pagination: {
        total: totalCount,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < totalCount,
      },
    });
  } catch (error) {
    console.error("[Public API] Error fetching userbook entries:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export default withPublicApiRateLimit(handler);
