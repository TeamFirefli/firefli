import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

const QUESTION_TYPES = new Set([
  "free_text",
  "short_text",
  "paragraph",
  "single_choice",
  "multiple_choice",
  "scale_slider",
  "yes_no",
]);

async function ensureForm(workspaceId: number, formId: string) {
  return prisma.applicationForm.findFirst({ where: { id: formId, workspaceGroupId: workspaceId } });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });
  const workspaceId = parseInt(req.query.id as string);
  const formId = req.query.formId as string;
  const form = await ensureForm(workspaceId, formId);
  if (!form) return res.status(404).json({ success: false, error: "Form not found" });

  const { title, description, type, required, points, config } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) return res.status(400).json({ success: false, error: "Title required" });
  if (typeof type !== "string" || !QUESTION_TYPES.has(type)) return res.status(400).json({ success: false, error: "Invalid question type" });

  const last = await prisma.applicationQuestion.findFirst({ where: { formId }, orderBy: { order: "desc" }, select: { order: true } });
  const order = (last?.order ?? -1) + 1;

  const question = await prisma.applicationQuestion.create({
    data: {
      formId,
      order,
      title: title.trim(),
      description: typeof description === "string" ? description : null,
      type,
      required: required !== false,
      points: Number.isFinite(points) ? Math.max(0, Math.trunc(points)) : 0,
      config: config && typeof config === "object" ? config : {},
    },
  });
  return res.status(201).json({ success: true, question });
}

export default withPermissionCheck(handler, "applications.manage");
