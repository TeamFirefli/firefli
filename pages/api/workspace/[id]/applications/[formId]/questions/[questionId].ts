import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

const FIELDS = ["title", "description", "type", "required", "points", "config", "order"] as const;
const TYPES = new Set([
  "free_text",
  "short_text",
  "paragraph",
  "single_choice",
  "multiple_choice",
  "scale_slider",
  "yes_no",
]);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = parseInt(req.query.id as string);
  const formId = req.query.formId as string;
  const questionId = req.query.questionId as string;

  const q = await prisma.applicationQuestion.findFirst({
    where: { id: questionId, formId, form: { workspaceGroupId: workspaceId } },
  });
  if (!q) return res.status(404).json({ success: false, error: "Question not found" });

  if (req.method === "PATCH") {
    const data: any = {};
    for (const f of FIELDS) {
      if (f in req.body) {
        if (f === "type" && !TYPES.has(req.body[f])) return res.status(400).json({ success: false, error: "Invalid type" });
        data[f] = req.body[f];
      }
    }
    const updated = await prisma.applicationQuestion.update({ where: { id: questionId }, data });
    return res.status(200).json({ success: true, question: updated });
  }

  if (req.method === "DELETE") {
    await prisma.applicationQuestion.delete({ where: { id: questionId } });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withPermissionCheck(handler, ["applications.manage", "applications.delete"]);
