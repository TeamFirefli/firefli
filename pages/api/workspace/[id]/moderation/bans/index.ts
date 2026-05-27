import { NextApiRequest, NextApiResponse } from "next";
import { withPermissionCheck } from "@/utils/permissionsManager";
import prisma from "@/utils/database";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: workspaceId } = req.query;
  const groupId = BigInt(workspaceId as string);
  if (req.method === "GET") {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required",
        });
      }

      const targetUserId = BigInt(userId as string);

      const activeBan = await prisma.playerBan.findFirst({
        where: {
          workspaceGroupId: groupId,
          userId: targetUserId,
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          workspace: {
            select: {
              groupName: true,
            },
          },
        },
      });

      const user = await prisma.user.findUnique({
        where: { userid: targetUserId },
        select: {
          banned: true,
          bannedAt: true,
          banReason: true,
        },
      });

      const isBanned = !!activeBan || (user?.banned ?? false);
      const banInfo = activeBan
        ? {
            id: activeBan.id,
            reason: activeBan.reason,
            bannedAt: activeBan.createdAt,
            expiresAt: activeBan.expiresAt,
            isPermanent: !activeBan.expiresAt,
            duration: activeBan.duration,
          }
        : user?.banned
          ? {
              reason: user.banReason,
              bannedAt: user.bannedAt,
              isPermanent: true,
            }
          : null;

      return res.status(200).json({
        success: true,
        data: {
          isBanned,
          userId: userId,
          ban: banInfo,
        },
      });
    } catch (error) {
      console.error("Error checking ban status:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to check ban status",
      });
    }
  }

  if (req.method === "POST") {
    try {
const {
  userId,
  username,
  reason,
  duration,
  expiresAt: providedExpiresAt,
  isPermanent = false,
  caseId,
} = req.body;

const finalExpiresAt = isPermanent
  ? null
  : providedExpiresAt
    ? new Date(providedExpiresAt)
    : duration
      ? new Date(Date.now() + Number(duration) * 1000)
      : null;

const finalDuration =
  !isPermanent && finalExpiresAt
    ? Math.max(0, Math.floor((finalExpiresAt.getTime() - Date.now()) / 1000))
    : null;

      if (!userId || !reason) {
        return res.status(400).json({
          success: false,
          error: "userId and reason are required",
        });
      }

      const targetUserId = BigInt(userId);
      const ban = await prisma.playerBan.create({
        data: {
          workspaceGroupId: groupId,
          userId: targetUserId,
          reason,
          bannedById: req.session.userid!,
          active: true,
          duration: finalDuration,
          expiresAt: finalExpiresAt,
        },
      });

      if (caseId) {
        const existingCase = await prisma.moderationCase.findFirst({
          where: {
            id: caseId,
            workspaceGroupId: groupId,
          },
          select: {
            action: true,
          },
        });
        await prisma.moderationCase.update({
          where: { id: caseId },
          data: {
            status: "resolved",
            action:
              existingCase?.action || (isPermanent ? "perm_ban" : "temp_ban"),
            resolvedAt: new Date(),
            resolvedBy: req.session.userid!,
            isPermanent,
            expiresAt: finalExpiresAt,
            banDuration: finalDuration,
          },
        });
      }

      await prisma.moderationLog.create({
        data: {
          workspaceGroupId: groupId,
          actionBy: req.session.userid!,
          action: "ban_executed",
          targetUser: targetUserId,
          targetUsername: username,
          caseId,
          details: {
            banId: ban.id,
            reason,
            duration: finalDuration,
            isPermanent,
            expiresAt: finalExpiresAt,
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          ban,
          message: isPermanent
            ? "User permanently banned"
            : `User banned for ${finalDuration} seconds`,
        },
      });
    } catch (error) {
      console.error("Error executing ban:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to execute ban",
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed",
  });
}

export default async function (req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return handler(req, res);
  }

  return withPermissionCheck(handler, ["execute_punishments"])(req, res);
}
