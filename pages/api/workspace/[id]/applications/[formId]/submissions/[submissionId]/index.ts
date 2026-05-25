import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });
  const workspaceId = parseInt(req.query.id as string);
  const formId = req.query.formId as string;
  const submissionId = req.query.submissionId as string;

  const submission = await prisma.applicationSubmission.findFirst({
    where: { id: submissionId, formId, workspaceGroupId: workspaceId },
    include: { form: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!submission) return res.status(404).json({ success: false, error: "Submission not found" });

  return res.status(200).json({ success: true, submission });
}

export default withPermissionCheck(handler, ["applications.view", "applications.review"]);
