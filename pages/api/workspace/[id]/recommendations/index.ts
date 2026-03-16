import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { logAudit } from "@/utils/logs";
import { getUsername, getThumbnail } from "@/utils/userinfoEngine";
import sanitizeHtml from "sanitize-html";
import { getConfig } from "@/utils/configEngine";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceGroupId = parseInt(req.query.id as string);

  const config = await getConfig('recommendations', workspaceGroupId);
  if (!config || !config.enabled) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  if (req.method === "GET") {
    const status = (req.query.status as string) || "active";
    const validStatuses = ["active", "archived", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status filter" });
    }

    const recommendations = await prisma.recommendation.findMany({
      where: {
        workspaceGroupId,
        status,
      },
      orderBy: { createdAt: "desc" },
      include: {
        votes: true,
        comments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const serialized = JSON.parse(
      JSON.stringify(recommendations, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return res.status(200).json({ success: true, recommendations: serialized });
  }

  if (req.method === "POST") {
    const userId = req.session.userid;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const body = req.body || {};
    const { targetUserId, targetUsername, reason } = body;
    if (targetUserId == null || targetUserId === "" || !targetUsername || !reason) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const sanitizedReason = sanitizeHtml(reason.toString().trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    if (!sanitizedReason || sanitizedReason.length > 5000) {
      return res.status(400).json({ success: false, error: "Invalid reason" });
    }

    try {
      const targetId = BigInt(targetUserId);

      const existingRecommendation = await prisma.recommendation.findFirst({
        where: {
          workspaceGroupId,
          targetUserId: targetId,
          status: {
            not: "archived",
          },
        },
      });

      if (existingRecommendation) {
        return res.status(409).json({
          success: false,
          error: "This user already has an active recommendation. Archive or delete it before creating a new one.",
        });
      }

      let picture: string | null = null;
      try {
        picture = await getThumbnail(Number(targetId));
      } catch {}

      let creatorName: string | null = null;
      try {
        creatorName = await getUsername(Number(userId));
      } catch {}

      const recommendation = await prisma.recommendation.create({
        data: {
          workspaceGroupId,
          targetUserId: targetId,
          targetUsername: targetUsername.toString().trim(),
          targetPicture: picture,
          reason: sanitizedReason,
          createdById: BigInt(userId),
          createdByName: creatorName,
        },
        include: {
          votes: true,
          comments: true,
        },
      });

      await logAudit(
        workspaceGroupId,
        Number(userId),
        "recommendation.create",
        "Recommendation",
        { targetUsername: targetUsername.toString().trim(), recommendationId: recommendation.id }
      );

      const serialized = JSON.parse(
        JSON.stringify(recommendation, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      );

      return res.status(200).json({ success: true, recommendation: serialized });
    } catch (error) {
      console.error("[recommendations POST] Error creating recommendation:", error);
      return res.status(500).json({ success: false, error: "Failed to create recommendation" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withPermissionCheck(handler, ["view_recommendations", "post_recommendations"]);
