// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { logAudit } from "@/utils/logs";

type Data = {
  success: boolean;
  error?: string;
  completion?: any;
};

export default withPermissionCheck(handler, "signoff_custom_quotas");

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  if (!req.session.userid) {
    return res.status(401).json({ success: false, error: "Not logged in" });
  }

  const quotaId = req.query.qid as string;
  const workspaceId = parseInt(req.query.id as string);
  const signoffUserId = BigInt(req.session.userid);
  const { targetUserId, notes } = req.body;

  if (!targetUserId) {
    return res
      .status(400)
      .json({ success: false, error: "Target user ID is required" });
  }

  const targetUser = BigInt(targetUserId);

  try {
    const quota = await prisma.quota.findUnique({
      where: { id: quotaId },
      include: {
        quotaRoles: {
          include: {
            role: true,
          },
        },
        quotaDepartments: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!quota || quota.workspaceGroupId !== workspaceId) {
      return res.status(404).json({ success: false, error: "Quota not found" });
    }

    if (quota.type !== "custom") {
      return res.status(400).json({
        success: false,
        error: "Only custom quotas can be manually signed off",
      });
    }

    if ((quota as any).completionType !== "manager_signoff") {
      return res.status(400).json({
        success: false,
        error: "This quota does not require manager signoff",
      });
    }

    const user = await prisma.user.findFirst({
      where: { userid: targetUser },
      include: {
        roles: {
          where: { workspaceGroupId: workspaceId },
        },
        workspaceMemberships: {
          where: { workspaceGroupId: workspaceId },
          include: {
            departmentMembers: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.roles.length) {
      return res
        .status(404)
        .json({ success: false, error: "Target user not found in workspace" });
    }

    const userRoleIds = user.roles.map((r) => r.id);
    const userDepartmentIds =
      user.workspaceMemberships[0]?.departmentMembers.map(
        (dm) => dm.department.id,
      ) || [];
    const hasQuotaViaRole = quota.quotaRoles.some((qr) =>
      userRoleIds.includes(qr.roleId),
    );
    const hasQuotaViaDept = quota.quotaDepartments.some((qd) =>
      userDepartmentIds.includes(qd.departmentId),
    );

    if (!hasQuotaViaRole && !hasQuotaViaDept) {
      return res.status(400).json({
        success: false,
        error: "This quota is not assigned to the target user",
      });
    }

    const completion = await (prisma as any).userQuotaCompletion.upsert({
      where: {
        quotaId_userId_workspaceGroupId: {
          quotaId,
          userId: targetUser,
          workspaceGroupId: workspaceId,
        },
      },
      create: {
        quotaId,
        userId: targetUser,
        workspaceGroupId: workspaceId,
        completed: true,
        completedAt: new Date(),
        completedBy: signoffUserId,
        notes: notes || null,
      },
      update: {
        completed: true,
        completedAt: new Date(),
        completedBy: signoffUserId,
        notes: notes || null,
      },
      include: {
        completedByUser: {
          select: {
            userid: true,
            username: true,
            picture: true,
          },
        },
      },
    });

    try {
      await logAudit(
        workspaceId,
        req.session.userid,
        "activity.quota.signoff",
        `quota:${quotaId}`,
        {
          quotaId,
          quotaName: quota.name,
          targetUserId: targetUser.toString(),
          signoffUserId: signoffUserId.toString(),
          notes,
        },
      );
    } catch (e) {
      console.error("Failed to log audit:", e);
    }

    return res.status(200).json({
      success: true,
      completion: JSON.parse(
        JSON.stringify(completion, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      ),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Something went wrong" });
  }
}