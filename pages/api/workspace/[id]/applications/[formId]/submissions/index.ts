import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });
  const workspaceId = parseInt(req.query.id as string);
  const formId = req.query.formId as string;

  const form = await prisma.applicationForm.findFirst({ where: { id: formId, workspaceGroupId: workspaceId } });
  if (!form) return res.status(404).json({ success: false, error: "Form not found" });

  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const take = Math.min(parseInt((req.query.limit as string) || "100") || 100, 500);

  const submissions = await prisma.applicationSubmission.findMany({
    where: { formId, ...(status ? { status } : {}) },
    orderBy: { submittedAt: "desc" },
    take,
    select: {
      id: true, userId: true, username: true, score: true, maxScore: true,
      percentage: true, passed: true, status: true, submittedAt: true, reviewedAt: true,
    },
  });

  return res.status(200).json({ success: true, submissions });
}

export default withPermissionCheck(handler, ["applications.view", "applications.review"]);
