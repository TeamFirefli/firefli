import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

type Data = {
  success: boolean;
  error?: string;
  categories?: any[];
  category?: any;
};

export default withPermissionCheck(handler, "manage_features");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceGroupId = parseInt(req.query.id as string);

  if (req.method === "GET") {
    const showArchived = req.query.archived === "1";
    const categories = await prisma.sessionRoleCategory.findMany({
      where: { workspaceGroupId, archived: showArchived },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ success: true, categories });
  }

  if (req.method === "POST") {
    const { name, weight } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }
    const resolvedWeight = typeof weight === "number" ? Math.max(0, Math.min(9999, Math.round(weight))) : 0;

    const category = await prisma.sessionRoleCategory.create({
      data: {
        name: name.trim().slice(0, 64),
        weight: resolvedWeight,
        workspaceGroupId,
      },
    });
    return res.status(200).json({ success: true, category });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
