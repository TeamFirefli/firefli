import { NextApiRequest, NextApiResponse } from "next";
import { withPermissionCheck } from "@/utils/permissionsManager";
import prisma from "@/utils/database";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { id: workspaceId, caseId } = req.query;
  const groupId = BigInt(workspaceId as string);

  try {
    const existingCase = await prisma.moderationCase.findFirst({
      where: {
        id: caseId as string,
        workspaceGroupId: groupId,
      },
    });

    if (!existingCase) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    if (existingCase.action !== "kick") {
      return res.status(400).json({ success: false, error: "Case action is not a kick" });
    }

    if (existingCase.status === "resolved") {
      return res.status(400).json({ success: false, error: "Kick has already been executed" });
    }

    if (existingCase.revokedAt) {
      return res.status(400).json({ success: false, error: "Case action has been revoked" });
    }

    const updatedCase = await prisma.moderationCase.update({
      where: { id: caseId as string },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: req.session.userid!,
      },
    });

    await prisma.moderationLog.create({
      data: {
        workspaceGroupId: groupId,
        actionBy: req.session.userid!,
        action: "kick_executed",
        targetUser: existingCase.targetUserId,
        targetUsername: existingCase.targetUsername,
        caseId: caseId as string,
        details: {
          reason: existingCase.reason,
        },
      },
    });

    return res.status(200).json({ success: true, data: updatedCase });
  } catch (error) {
    console.error("Error executing kick:", error);
    return res.status(500).json({ success: false, error: "Failed to execute kick" });
  }
}

export default withPermissionCheck(handler, ["execute_punishments"]);
