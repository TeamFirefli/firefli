import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { rankUser } from "@/utils/roblox/rankUser";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") return res.status(405).json({ success: false, error: "Method not allowed" });
  const workspaceId = parseInt(req.query.id as string);
  const formId = req.query.formId as string;
  const submissionId = req.query.submissionId as string;
  const reviewerId = req.session?.userid;
  if (!reviewerId) return res.status(401).json({ success: false, error: "Unauthorized" });

  const { passed, note } = req.body ?? {};
  if (typeof passed !== "boolean") return res.status(400).json({ success: false, error: "passed boolean required" });

  const submission = await prisma.applicationSubmission.findFirst({
    where: { id: submissionId, formId, workspaceGroupId: workspaceId },
    include: { form: true },
  });
  if (!submission) return res.status(404).json({ success: false, error: "Submission not found" });
  if (submission.status !== "pending_review") {
    return res.status(400).json({ success: false, error: "Submission is not pending review" });
  }

  const breakdown = (submission.markingBreakdown as any) ?? {};
  const reviewMeta = { reviewerNote: note ?? null, reviewedAt: new Date().toISOString() };

  let rankActionResult: any = submission.rankActionResult ?? null;
  let finalStatus: "passed" | "failed" | "action_failed" = passed ? "passed" : "failed";

  const passRankId = (submission.form as any).passRankId as bigint | null | undefined;
  if (passed && submission.form.rankActionEnabled && passRankId !== null && passRankId !== undefined) {
    const result = await rankUser(workspaceId, submission.userId, passRankId);
    rankActionResult = result;
    if (result.attempted && !result.success) finalStatus = "action_failed";
  }

  const updated = await prisma.applicationSubmission.update({
    where: { id: submissionId },
    data: {
      passed,
      status: finalStatus,
      reviewedAt: new Date(),
      reviewedById: BigInt(reviewerId),
      rankActionResult,
      markingBreakdown: { ...breakdown, review: reviewMeta },
    },
  });

  return res.status(200).json({ success: true, submission: updated });
}

export default withPermissionCheck(handler, "applications.review");
