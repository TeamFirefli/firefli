import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

type Data = {
  success: boolean;
  error?: string;
  archived?: boolean;
  template?: any;
};

export default withPermissionCheck(handler, "manage_features");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceGroupId = parseInt(req.query.id as string);
  const templateId = req.query.rid as string;

  const existing = await prisma.sessionRoleTemplate.findUnique({
    where: { id: templateId },
  });

  if (!existing || existing.workspaceGroupId !== workspaceGroupId) {
    return res.status(404).json({ success: false, error: "Template not found" });
  }

  if (req.method === "PATCH") {
    const { name, categoryId, hostRole, slots, groupRoles, archived, weight } = req.body;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ success: false, error: "Name cannot be empty" });
    }

    const validGroupRoles = Array.isArray(groupRoles)
      ? groupRoles.filter((r: any) => Number.isInteger(r) && r > 0)
      : existing.groupRoles;

    let resolvedCategoryId: string | null | undefined = undefined;
    if (categoryId !== undefined) {
      if (categoryId === null) {
        resolvedCategoryId = null;
      } else if (typeof categoryId === "string") {
        const cat = await prisma.sessionRoleCategory.findUnique({ where: { id: categoryId } });
        resolvedCategoryId = (cat && cat.workspaceGroupId === workspaceGroupId) ? categoryId : null;
      }
    }

    const template = await prisma.sessionRoleTemplate.update({
      where: { id: templateId },
      data: {
        ...(name !== undefined && { name: name.trim().slice(0, 64) }),
        ...(resolvedCategoryId !== undefined && { categoryId: resolvedCategoryId }),
        ...(hostRole !== undefined && { hostRole: hostRole || null }),
        ...(slots !== undefined && { slots: Math.max(1, Math.min(100, parseInt(slots) || 1)) }),
        ...(archived !== undefined && { archived: Boolean(archived) }),
        ...(weight !== undefined && { weight: Math.max(0, Math.min(9999, Math.round(parseInt(weight) || 0))) }),
        groupRoles: validGroupRoles,
      },
      include: { category: true },
    });

    return res.status(200).json({ success: true, template });
  }

  if (req.method === "DELETE") {
    // Archive if template has ever been used in a session; otherwise hard-delete
    const usedCount = await prisma.sessionUser.count({
      where: { roleID: templateId },
    });
    if (usedCount > 0) {
      const template = await prisma.sessionRoleTemplate.update({
        where: { id: templateId },
        data: { archived: true },
        include: { category: true },
      });
      return res.status(200).json({ success: true, archived: true, template });
    }
    await prisma.sessionRoleTemplate.delete({ where: { id: templateId } });
    return res.status(200).json({ success: true, archived: false });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
