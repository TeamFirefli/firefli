import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

const UPDATABLE_FIELDS = [
  "name",
  "description",
  "enabled",
  "passingScore",
  "maxAttempts",
  "cooldownMinutes",
  "requireManualReview",
  "allowRetake",
  "rankActionEnabled",
  "passRankId",
  "requiredRankId",
] as const;

const BIGINT_FIELDS = new Set(["passRankId", "requiredRankId"]);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = parseInt(req.query.id as string);
  const formId = req.query.formId as string;
  if (!workspaceId || !formId) return res.status(400).json({ success: false, error: "Invalid params" });

  const form = await prisma.applicationForm.findFirst({
    where: { id: formId, workspaceGroupId: workspaceId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!form) return res.status(404).json({ success: false, error: "Form not found" });

  if (req.method === "GET") {
    return res.status(200).json({ success: true, form });
  }

  if (req.method === "PATCH") {
    const data: any = {};
    for (const field of UPDATABLE_FIELDS) {
      if (field in req.body) {
        let value = req.body[field];
        if (BIGINT_FIELDS.has(field)) {
          if (value === "" || value === null || value === undefined) {
            value = null;
          } else {
            try { value = BigInt(value); } catch { return res.status(400).json({ success: false, error: `Invalid ${field}` }); }
          }
        }
        data[field] = value;
      }
    }
    const updated = await prisma.applicationForm.update({ where: { id: formId }, data });
    return res.status(200).json({ success: true, form: updated });
  }

  if (req.method === "DELETE") {
    await prisma.applicationForm.delete({ where: { id: formId } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withPermissionCheck(handler, ["applications.view", "applications.manage", "applications.delete"]);
