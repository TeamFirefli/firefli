import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { logAudit } from "@/utils/logs";
import sanitizeHtml from "sanitize-html";
import { getConfig } from "@/utils/configEngine";

async function getActorAccess(userId: number, workspaceGroupId: number) {
  const user = await prisma.user.findUnique({
    where: { userid: BigInt(userId) },
    include: {
      roles: {
        where: { workspaceGroupId },
      },
      workspaceMemberships: {
        where: { workspaceGroupId },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    isAdmin: user.workspaceMemberships[0]?.isAdmin || false,
    permissions: user.roles[0]?.permissions || [],
  };
}

function hasAnyPermission(userPermissions: string[], required: string[]) {
  return required.some((permission) => userPermissions.includes(permission));
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceGroupId = parseInt(req.query.id as string);
  const recId = req.query.recId as string;

  const config = await getConfig('recommendations', workspaceGroupId);
  if (!config || !config.enabled) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  if (req.method === "GET") {
    const userId = req.session.userid;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const actorAccess = await getActorAccess(Number(userId), workspaceGroupId);
    if (!actorAccess) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (
      !actorAccess.isAdmin &&
      !hasAnyPermission(actorAccess.permissions, [
        "view_recommendations",
        "manage_recommendations",
      ])
    ) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: { id: recId, workspaceGroupId },
      include: {
        votes: true,
        comments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!recommendation) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const serialized = JSON.parse(
      JSON.stringify(recommendation, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return res.status(200).json({ success: true, recommendation: serialized });
  }

  if (req.method === "PUT") {
    const userId = req.session.userid;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const actorAccess = await getActorAccess(Number(userId), workspaceGroupId);
    if (!actorAccess) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!actorAccess.isAdmin && !actorAccess.permissions.includes("manage_recommendations")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: "Missing reason" });
    }

    const sanitizedReason = sanitizeHtml(reason.toString().trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    if (!sanitizedReason || sanitizedReason.length > 5000) {
      return res.status(400).json({ success: false, error: "Invalid reason" });
    }

    const existing = await prisma.recommendation.findFirst({
      where: { id: recId, workspaceGroupId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    let editorName: string | null = null;
    try {
      const user = await prisma.user.findUnique({ where: { userid: BigInt(userId) } });
      editorName = user?.username || null;
    } catch {}

    const updated = await prisma.recommendation.update({
      where: { id: recId },
      data: {
        reason: sanitizedReason,
        editedById: BigInt(userId),
        editedByName: editorName,
        editedAt: new Date(),
      },
      include: {
        votes: true,
        comments: { orderBy: { createdAt: "asc" } },
      },
    });

    await logAudit(
      workspaceGroupId,
      Number(userId),
      "recommendation.edit",
      "Recommendation",
      { recommendationId: recId }
    );

    const serialized = JSON.parse(
      JSON.stringify(updated, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return res.status(200).json({ success: true, recommendation: serialized });
  }

  if (req.method === "DELETE") {
    const userId = req.session.userid;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const actorAccess = await getActorAccess(Number(userId), workspaceGroupId);
    if (!actorAccess) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!actorAccess.isAdmin && !actorAccess.permissions.includes("delete_recommendations")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const existing = await prisma.recommendation.findFirst({
      where: { id: recId, workspaceGroupId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    await prisma.recommendation.delete({ where: { id: recId } });

    await logAudit(
      workspaceGroupId,
      Number(userId),
      "recommendation.delete",
      "Recommendation",
      { recommendationId: recId, targetUsername: existing.targetUsername }
    );

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withPermissionCheck(handler, ["view_recommendations", "manage_recommendations"]);
