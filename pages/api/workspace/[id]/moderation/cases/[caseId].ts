import { NextApiRequest, NextApiResponse } from "next";
import { withPermissionCheck } from "@/utils/permissionsManager";
import prisma from "@/utils/database";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: workspaceId, caseId } = req.query;
  const groupId = BigInt(workspaceId as string);

  if (req.method === "GET") {
    try {
      const moderationCase = await prisma.moderationCase.findFirst({
        where: {
          id: caseId as string,
          workspaceGroupId: groupId,
        },
        include: {
          targetUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          createdByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          resolvedByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          reportedByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          revokedByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          evidence: {
            include: {
              uploader: {
                select: {
                  userid: true,
                  username: true,
                  picture: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!moderationCase) {
        return res.status(404).json({
          success: false,
          error: "Case not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: moderationCase,
      });
    } catch (error) {
      console.error("Error fetching moderation case:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch moderation case",
      });
    }
  }

  if (req.method === "PUT") {
    try {
      const {
        status,
        action,
        reason,
        description,
        internalNotes,
        publicNote,
        banDuration,
        isPermanent,
        resolvedAt,
        expiresAt,
        placeIds,
      } = req.body;

      const existingCase = await prisma.moderationCase.findFirst({
        where: {
          id: caseId as string,
          workspaceGroupId: groupId,
        },
      });

      if (!existingCase) {
        return res.status(404).json({
          success: false,
          error: "Case not found",
        });
      }

      const isAuthor = existingCase.createdBy === req.session.userid!;
      const user = await prisma.user.findFirst({
        where: {
          userid: req.session.userid!,
        },
        include: {
          roles: {
            where: {
              workspaceGroupId: groupId,
            },
          },
          workspaceMemberships: {
            where: {
              workspaceGroupId: groupId,
            },
          },
        },
      });
      
      const membership = user?.workspaceMemberships[0];
      const userRole = user?.roles[0];
      const isAdmin = membership?.isAdmin || false;
      const hasEditPermission = userRole?.permissions?.includes("edit_moderation_cases") || isAdmin;

      if (!isAuthor && !hasEditPermission) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to edit this case",
        });
      }

      const updateData: any = {};
      if (status !== undefined) updateData.status = status;
      if (action !== undefined) updateData.action = action;
      if (reason !== undefined) updateData.reason = reason;
      if (description !== undefined) updateData.description = description;
      if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
      if (publicNote !== undefined) updateData.publicNote = publicNote;
      if (banDuration !== undefined) updateData.banDuration = banDuration;
      if (isPermanent !== undefined) updateData.isPermanent = isPermanent;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
      if (placeIds !== undefined) {
        updateData.placeIds = Array.isArray(placeIds)
          ? placeIds
              .map((id: any) => { try { return BigInt(id); } catch { return null; } })
              .filter((id: bigint | null): id is bigint => id !== null)
          : [];
      }
      if (status === "resolved" && existingCase.status !== "resolved") {
        updateData.resolvedAt = resolvedAt || new Date();
        updateData.resolvedBy = req.session.userid!;
      }

      const updatedCase = await prisma.moderationCase.update({
        where: {
          id: caseId as string,
        },
        data: updateData,
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
        },
      });

      const logDetails: Record<string, any> = {};
      for (const [k, v] of Object.entries(updateData)) {
        logDetails[k] = typeof v === "bigint" ? v.toString() : v instanceof Date ? v.toISOString() : v;
      }

      await prisma.moderationLog.create({
        data: {
          workspaceGroupId: groupId,
          actionBy: req.session.userid!,
          action: status === "resolved" ? "case_resolved" : "case_updated",
          targetUser: existingCase.targetUserId,
          targetUsername: existingCase.targetUsername,
          caseId: caseId as string,
          details: logDetails,
        },
      });

      return res.status(200).json({
        success: true,
        data: updatedCase,
      });
    } catch (error) {
      console.error("Error updating moderation case:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update moderation case",
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const existingCase = await prisma.moderationCase.findFirst({
        where: {
          id: caseId as string,
          workspaceGroupId: groupId,
        },
      });

      if (!existingCase) {
        return res.status(404).json({
          success: false,
          error: "Case not found",
        });
      }

      const isAuthor = existingCase.createdBy === req.session.userid!;
      const user = await prisma.user.findFirst({
        where: {
          userid: req.session.userid!,
        },
        include: {
          roles: {
            where: {
              workspaceGroupId: groupId,
            },
          },
          workspaceMemberships: {
            where: {
              workspaceGroupId: groupId,
            },
          },
        },
      });
      
      const membership = user?.workspaceMemberships[0];
      const userRole = user?.roles[0];
      const isAdmin = membership?.isAdmin || false;
      const hasDeletePermission = userRole?.permissions?.includes("delete_moderation_cases") || isAdmin;

      if (!hasDeletePermission) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to delete this case",
        });
      }

      if (existingCase.action === "temp_ban" || existingCase.action === "perm_ban") {
        await prisma.playerBan.deleteMany({
          where: {
            workspaceGroupId: groupId,
            userId: existingCase.targetUserId,
            active: true,
            reason: existingCase.reason,
          },
        });
      }

      await prisma.moderationCase.delete({
        where: {
          id: caseId as string,
        },
      });

      const { deleteCaseEvidence } = await import("@/utils/evidenceManager");
      deleteCaseEvidence(caseId as string);
      await prisma.moderationLog.create({
        data: {
          workspaceGroupId: groupId,
          actionBy: req.session.userid!,
          action: "case_deleted",
          targetUser: existingCase.targetUserId,
          targetUsername: existingCase.targetUsername,
          caseId: caseId as string,
          details: {
            reason: existingCase.reason,
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "Case deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting moderation case:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to delete moderation case",
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
  if (req.method === "PUT") {
    return withPermissionCheck(handler, ["view_moderation"])(req, res);
  }
  if (req.method === "DELETE") {
    return withPermissionCheck(handler, ["delete_moderation_cases"])(req, res);
  }
  return handler(req, res);
}
