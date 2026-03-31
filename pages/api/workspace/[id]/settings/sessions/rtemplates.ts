import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { withSessionRoute } from "@/lib/withSession";

type Data = {
  success: boolean;
  error?: string;
  templates?: any[];
  template?: any;
};

export default withSessionRoute(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceGroupId = parseInt(req.query.id as string);

  if (req.method === "GET") {
    if (!req.session?.userid) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }
    const showArchived = req.query.archived === "1";
    const templates = await prisma.sessionRoleTemplate.findMany({
      where: { workspaceGroupId, archived: showArchived },
      include: { category: true },
      orderBy: [{ weight: "asc" }, { createdAt: "asc" }],
    });
    return res.status(200).json({ success: true, templates });
  }

  if (req.method === "POST") {
    // Mutations require manage_features permission
    const userId = req.session?.userid;
    if (!userId) return res.status(401).json({ success: false, error: "Not logged in" });
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: BigInt(userId), workspaceGroupId },
    });
    const roles = await prisma.role.findMany({
      where: { workspaceGroupId, members: { some: { userid: BigInt(userId) } } },
    });
    const isAdmin = member?.isAdmin || roles.some((r: any) => Array.isArray(r.permissions) && r.permissions.includes("admin"));
    const hasManage = roles.some((r: any) => Array.isArray(r.permissions) && r.permissions.includes("manage_features"));
    if (!isAdmin && !hasManage) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    const { name, categoryId, hostRole, slots, groupRoles, weight } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    const trimmedName = name.trim().slice(0, 64);
    let resolvedCategoryId: string | null = null;
    if (categoryId && typeof categoryId === "string") {
      const cat = await prisma.sessionRoleCategory.findUnique({ where: { id: categoryId } });
      if (cat && cat.workspaceGroupId === workspaceGroupId) {
        resolvedCategoryId = categoryId;
      }
    }
    const slotsCount = Math.max(1, Math.min(100, parseInt(slots) || 1));
    const resolvedWeight = typeof weight === "number" ? Math.max(0, Math.min(9999, Math.round(weight))) : 0;
    const validGroupRoles = Array.isArray(groupRoles)
      ? groupRoles.filter((r: any) => Number.isInteger(r) && r > 0)
      : [];

    const template = await prisma.sessionRoleTemplate.create({
      data: {
        name: trimmedName,
        categoryId: resolvedCategoryId,
        hostRole: hostRole || null,
        slots: slotsCount,
        weight: resolvedWeight,
        groupRoles: validGroupRoles,
        workspaceGroupId,
      },
      include: { category: true },
    });

    return res.status(200).json({ success: true, template });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
