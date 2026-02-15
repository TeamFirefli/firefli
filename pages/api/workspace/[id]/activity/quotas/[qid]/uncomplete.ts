// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { logAudit } from "@/utils/logs";

type Data = {
  success: boolean;
  error?: string;
};

export default withPermissionCheck(handler);

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  if (!req.session.userid) {
    return res.status(401).json({ success: false, error: "Not logged in" });
  }

  const quotaId = req.query.qid as string;
  const workspaceId = parseInt(req.query.id as string);
  const currentUserId = BigInt(req.session.userid);
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res
      .status(400)
      .json({ success: false, error: "Target user ID is required" });
  }

  const targetUser = BigInt(targetUserId);

  try {
    const quota = await prisma.quota.findUnique({
      where: { id: quotaId },
    });

    if (!quota || quota.workspaceGroupId !== workspaceId) {
      return res.status(404).json({ success: false, error: "Quota not found" });
    }
    const completion = await (prisma as any).userQuotaCompletion.findUnique({
      where: {
        quotaId_userId_workspaceGroupId: {
          quotaId,
          userId: targetUser,
          workspaceGroupId: workspaceId,
        },
      },
    });

    if (!completion) {
      return res
        .status(404)
        .json({ success: false, error: "Completion record not found" });
    }

    const canUncomplete = await checkUncompletPermission(
      currentUserId,
      targetUser,
      quota,
      workspaceId,
    );

    if (!canUncomplete) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to uncomplete this quota",
      });
    }

    await (prisma as any).userQuotaCompletion.update({
      where: {
        quotaId_userId_workspaceGroupId: {
          quotaId,
          userId: targetUser,
          workspaceGroupId: workspaceId,
        },
      },
      data: {
        completed: false,
        completedAt: null,
        completedBy: null,
        notes: null,
      },
    });

    try {
      await logAudit(
        workspaceId,
        req.session.userid,
        "activity.quota.uncomplete",
        `quota:${quotaId}`,
        {
          quotaId,
          quotaName: quota.name,
          targetUserId: targetUser.toString(),
        },
      );
    } catch (e) {
      console.error("Failed to log audit:", e);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
}

async function checkUncompletPermission(
  currentUserId: bigint,
  targetUserId: bigint,
  quota: any,
  workspaceId: number,
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { userid: currentUserId },
    include: {
      roles: {
        where: { workspaceGroupId: workspaceId },
      },
      workspaceMemberships: {
        where: { workspaceGroupId: workspaceId },
      },
    },
  });

  if (!user || !user.roles.length) return false;

  const membership = user.workspaceMemberships[0];
  const isAdmin = membership?.isAdmin || false;
  if (isAdmin) return true;
  if (
    quota.completionType === "user_complete" &&
    currentUserId === targetUserId
  ) {
    return true;
  }
  if (quota.completionType === "manager_signoff") {
    return user.roles[0].permissions.includes("signoff_custom_quotas");
  }
  return false;
}