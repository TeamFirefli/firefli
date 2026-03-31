import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

type Data = {
  success: boolean;
  error?: string;
  archived?: boolean;
  category?: any;
};

export default withPermissionCheck(handler, "manage_features");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceGroupId = parseInt(req.query.id as string);
  const categoryId = req.query.cid as string;

  const existing = await prisma.sessionRoleCategory.findUnique({
    where: { id: categoryId },
  });

  if (!existing || existing.workspaceGroupId !== workspaceGroupId) {
    return res.status(404).json({ success: false, error: "Category not found" });
  }

  if (req.method === "PATCH") {
    const { name, archived } = req.body;
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }
    const category = await prisma.sessionRoleCategory.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name: name.trim().slice(0, 64) }),
        ...(archived !== undefined && { archived: Boolean(archived) }),
      },
    });
    return res.status(200).json({ success: true, category });
  }

  if (req.method === "DELETE") {
    // Archive if any template in this category has been used in a session; otherwise hard-delete
    const categoryTemplates = await prisma.sessionRoleTemplate.findMany({
      where: { categoryId },
      select: { id: true },
    });
    const templateIds = categoryTemplates.map((t) => t.id);
    const usedCount =
      templateIds.length > 0
        ? await prisma.sessionUser.count({ where: { roleID: { in: templateIds } } })
        : 0;
    if (usedCount > 0) {
      const category = await prisma.sessionRoleCategory.update({
        where: { id: categoryId },
        data: { archived: true },
      });
      return res.status(200).json({ success: true, archived: true, category });
    }
    await prisma.sessionRoleCategory.delete({ where: { id: categoryId } });
    return res.status(200).json({ success: true, archived: false });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
