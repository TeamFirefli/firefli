import { NextApiRequest, NextApiResponse } from "next";
import { withPermissionCheck } from "@/utils/permissionsManager";
import prisma from "@/utils/database";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: workspaceId } = req.query;
  const groupId = BigInt(workspaceId as string);

  if (req.method === "GET") {
    try {
      const {
        status,
        action,
        targetUserId,
        createdBy,
        page = "1",
        limit = "50",
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
      } = req.query;

      const where: any = {
        workspaceGroupId: groupId,
      };

      if (status === "revoked") {
        where.revokedAt = { not: null };
      } else if (status) {
        where.status = status as string;
        where.revokedAt = null;
      }
      if (action) where.action = action as string;
      if (targetUserId) where.targetUserId = BigInt(targetUserId as string);
      if (createdBy) where.createdBy = BigInt(createdBy as string);
      if (search && typeof search === "string" && search.trim()) {
        where.OR = [
          { targetUsername: { contains: search.trim(), mode: "insensitive" } },
          { reason: { contains: search.trim(), mode: "insensitive" } },
        ];
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;
      const orderBy: any = {};
      orderBy[sortBy as string] = sortOrder as string;
      const [cases, total] = await Promise.all([
        prisma.moderationCase.findMany({
          where,
          include: {
            targetUser: {
              select: {
                userid: true,
                username: true,
                picture: true,
              },
            },
            createdByUser: {
              select: {
                userid: true,
                username: true,
                picture: true,
              },
            },
            resolvedByUser: {
              select: {
                userid: true,
                username: true,
                picture: true,
              },
            },
            reportedByUser: {
              select: {
                userid: true,
                username: true,
                picture: true,
              },
            },
            evidence: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                fileSize: true,
                createdAt: true,
              },
            },
          },
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.moderationCase.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          cases,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching moderation cases:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch moderation cases",
      });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        targetUserId,
        targetUsername,
        reason,
        description,
        action,
        reportedBy,
        internalNotes,
        publicNote,
        banDuration,
        isPermanent = false,
        expiresAt,
      } = req.body;

      if (!targetUserId || !reason) {
        return res.status(400).json({
          success: false,
          error: "targetUserId and reason are required",
        });
      }

	  const allowedActions = ["warning", "kick", "temp_ban", "perm_ban"];

		if (!action || !allowedActions.includes(action)) {
		return res.status(400).json({
			success: false,
			error: "Invalid action. Must be warning, kick, or ban.",
		});
		}

		if (action === "temp_ban" && !expiresAt) {
		return res.status(400).json({
			success: false,
			error: "expiresAt is required for temporary bans",
		});
		}

		const finalIsPermanent = action === "perm_ban";
		const finalExpiresAt = action === "temp_ban" && expiresAt ? new Date(expiresAt) : null;

      const moderationCase = await prisma.moderationCase.create({
        data: {
          workspaceGroupId: groupId,
          targetUserId: BigInt(targetUserId),
          targetUsername,
          createdBy: req.session.userid!,
          reason,
          description,
          action,
          reportedBy: reportedBy ? BigInt(reportedBy) : null,
          internalNotes,
          publicNote,
          banDuration,
          isPermanent: finalIsPermanent,
          expiresAt: finalExpiresAt,
        },
        include: {
          targetUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
          createdByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
      });

      await prisma.moderationLog.create({
        data: {
          workspaceGroupId: groupId,
          actionBy: req.session.userid!,
          action: "case_created",
          targetUser: BigInt(targetUserId),
          targetUsername,
          caseId: moderationCase.id,
          details: {
            reason,
            action,
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: moderationCase,
      });
    } catch (error) {
      console.error("Error creating moderation case:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create moderation case",
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
    return withPermissionCheck(handler, ["view_moderation"])(req, res);
  }
  if (req.method === "POST") {
    return withPermissionCheck(handler, ["create_moderation_cases"])(req, res);
  }
  return handler(req, res);
}
