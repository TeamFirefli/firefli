import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { logAudit } from "@/utils/logs";

type Data = {
  success: boolean;
  error?: string;
  containers?: any[];
  container?: any;
};

export default withPermissionCheck(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" });

  if (req.method === "GET") {
    const user = await prisma.user.findFirst({
      where: { userid: req.session.userid },
      include: {
        roles: { where: { workspaceGroupId: workspaceId } },
        workspaceMemberships: {
          where: { workspaceGroupId: workspaceId },
          include: {
            departmentMembers: { include: { department: true } },
          },
        },
      },
    });

    if (!user) return res.status(403).json({ success: false, error: "Forbidden" });

    const membership = user.workspaceMemberships?.[0];
    const isAdmin = membership?.isAdmin || false;
    const userRoleIds = (user.roles || []).map((r: any) => r.id);
    const userDepartmentIds = (membership?.departmentMembers || []).map(
      (dm: any) => dm.department.id
    );
    const canManage = isAdmin || (user.roles || []).some((r: any) =>
      (r.permissions || []).some((p: string) =>
        ["create_docs", "edit_docs", "delete_docs"].includes(p)
      )
    );

    const where = canManage
      ? { workspaceGroupId: workspaceId }
      : {
          workspaceGroupId: workspaceId,
          OR: [
            { roles: { some: { id: { in: userRoleIds } } } },
            ...(userDepartmentIds.length > 0
              ? [{ departments: { some: { id: { in: userDepartmentIds } } } }]
              : []),
          ],
        };

    const containers = await prisma.documentContainer.findMany({
      where,
      include: {
        owner: { select: { userid: true, username: true, picture: true } },
        roles: { select: { id: true, name: true } },
        departments: { select: { id: true, name: true } },
        documents: {
          where: { requiresAcknowledgment: false },
          select: { id: true, name: true, content: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({
      success: true,
      containers: JSON.parse(
        JSON.stringify(containers, (_, v) => (typeof v === "bigint" ? v.toString() : v))
      ),
    });
  }

  if (req.method === "POST") {
    const user = await prisma.user.findFirst({
      where: { userid: req.session.userid },
      include: {
        roles: { where: { workspaceGroupId: workspaceId } },
        workspaceMemberships: { where: { workspaceGroupId: workspaceId } },
      },
    });

    if (!user) return res.status(403).json({ success: false, error: "Forbidden" });

    const membership = user.workspaceMemberships?.[0];
    const isAdmin = membership?.isAdmin || false;
    const canCreate = isAdmin || (user.roles || []).some((r: any) =>
      (r.permissions || []).includes("create_docs")
    );

    if (!canCreate) return res.status(403).json({ success: false, error: "Insufficient permissions" });

    const { name, description, roles, departments } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Container name is required" });
    }
    const hasRoles = Array.isArray(roles) && roles.length > 0;
    const hasDepartments = Array.isArray(departments) && departments.length > 0;
    if (!hasRoles && !hasDepartments) {
      return res
        .status(400)
        .json({ success: false, error: "At least one role or department must be selected" });
    }

    const container = await prisma.documentContainer.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        workspaceGroupId: workspaceId,
        ownerId: BigInt(req.session.userid),
        roles: { connect: roles.map((id: string) => ({ id })) },
        departments: { connect: departments.map((id: string) => ({ id })) },
      },
      include: {
        owner: { select: { userid: true, username: true, picture: true } },
        roles: { select: { id: true, name: true } },
        departments: { select: { id: true, name: true } },
        documents: true,
      },
    });

    try {
      await logAudit(workspaceId, Number(req.session.userid), "container.create", `container:${container.id}`, { id: container.id, name: container.name });
    } catch {}

    return res.status(200).json({
      success: true,
      container: JSON.parse(
        JSON.stringify(container, (_, v) => (typeof v === "bigint" ? v.toString() : v))
      ),
    });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
