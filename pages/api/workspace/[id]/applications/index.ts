import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) return res.status(400).json({ success: false, error: "Invalid workspace id" });

  if (req.method === "GET") {
    const forms = await prisma.applicationForm.findMany({
      where: { workspaceGroupId: workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { questions: true, submissions: true } } },
    });
    return res.status(200).json({ success: true, forms });
  }

  if (req.method === "POST") {
    const userId = req.session?.userid;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const { name, description } = req.body ?? {};
    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }
    const form = await prisma.applicationForm.create({
      data: {
        workspaceGroupId: workspaceId,
        name: name.trim(),
        description: typeof description === "string" ? description : null,
        createdById: BigInt(userId),
      },
    });
    return res.status(201).json({ success: true, form });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withPermissionCheck(handler, ["applications.view", "applications.manage"]);
