import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") return res.status(405).json({ success: false, error: "Method not allowed" });
  const workspaceId = parseInt(req.query.id as string);
  const formId = req.query.formId as string;
  const { order } = req.body ?? {};
  if (!Array.isArray(order) || !order.every((x) => typeof x === "string")) {
    return res.status(400).json({ success: false, error: "order must be an array of question ids" });
  }

  const existing = await prisma.applicationQuestion.findMany({
    where: { formId, form: { workspaceGroupId: workspaceId } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((q) => q.id));
  if (order.length !== existing.length || !order.every((id) => existingIds.has(id))) {
    return res.status(400).json({ success: false, error: "order does not match existing questions" });
  }

  await prisma.$transaction(
    order.map((id, idx) =>
      prisma.applicationQuestion.update({ where: { id }, data: { order: idx } })
    )
  );
  return res.status(200).json({ success: true });
}

export default withPermissionCheck(handler, "applications.manage");
