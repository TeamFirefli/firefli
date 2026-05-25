import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { validateApiKey } from "@/utils/api-auth";
import { withPublicApiRateLimit } from "@/utils/prtl";
import { sanitiseQuestionForPublic } from "@/utils/applications/sanitise";
import { markSubmission, MarkingValidationError } from "@/utils/applications/markSubmission";
import { rankUser } from "@/utils/roblox/rankUser";
import { getGroupRoles, getRankInGroup } from "@/utils/roblox";
import type { QuestionRecord, SubmittedAnswer } from "@/utils/applications/types";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" });

  const workspaceId = Number.parseInt(req.query.id as string);
  const formId = req.query.formId as string;
  if (!workspaceId || !formId) return res.status(400).json({ success: false, error: "Missing parameters" });

  const key = await validateApiKey(apiKey, workspaceId);
  if (!key) return res.status(401).json({ success: false, error: "Invalid API key" });

  const form = await prisma.applicationForm.findFirst({
    where: { id: formId, workspaceGroupId: workspaceId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!form || !form.enabled) return res.status(404).json({ success: false, error: "Application not available" });

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      data: {
        id: form.id,
        name: form.name,
        description: form.description,
        questions: form.questions.map((q) =>
          sanitiseQuestionForPublic({
            id: q.id,
            formId: q.formId,
            order: q.order,
            title: q.title,
            description: q.description,
            type: q.type,
            required: q.required,
            points: q.points,
            config: (q.config as any) ?? {},
          })
        ),
      },
    });
  }

  if (req.method === "PUT") {
    const body = req.body ?? {};
    const userIdRaw = body.userId;
    const username = typeof body.username === "string" ? body.username : null;
    const answersRaw = body.answers;
    if (userIdRaw === undefined || userIdRaw === null) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    let userIdBig: bigint;
    try { userIdBig = BigInt(userIdRaw); } catch { return res.status(400).json({ success: false, error: "Invalid userId" }); }
    if (userIdBig <= 0n) return res.status(400).json({ success: false, error: "Invalid userId" });
    if (!Array.isArray(answersRaw)) return res.status(400).json({ success: false, error: "answers must be an array" });

    const requiredRankId = (form as any).requiredRankId as bigint | null | undefined;
    if (requiredRankId !== null && requiredRankId !== undefined) {
      const roles = await getGroupRoles(workspaceId);
      const requiredRole = roles.find((r) => BigInt(r.id) === requiredRankId);
      if (!requiredRole) {
        return res.status(500).json({ success: false, error: "Required rank no longer exists in group" });
      }
      const userRank = await getRankInGroup(workspaceId, Number(userIdBig));
      if (userRank === null || userRank < requiredRole.rank) {
        return res.status(403).json({ success: false, error: "You do not meet the minimum rank required to take this application" });
      }
    }

    if (form.maxAttempts && form.maxAttempts > 0) {
      const attempts = await prisma.applicationSubmission.count({
        where: { formId: form.id, userId: userIdBig },
      });
      if (attempts >= form.maxAttempts) {
        return res.status(429).json({ success: false, error: "Maximum attempts reached" });
      }
    }
    const lastSubmission = await prisma.applicationSubmission.findFirst({
      where: { formId: form.id, userId: userIdBig },
      orderBy: { submittedAt: "desc" },
    });
    if (lastSubmission) {
      if (!form.allowRetake && (lastSubmission.status === "passed" || lastSubmission.status === "pending_review")) {
        return res.status(409).json({ success: false, error: "Retakes not allowed" });
      }
      if (form.cooldownMinutes && form.cooldownMinutes > 0) {
        const nextAt = new Date(lastSubmission.submittedAt.getTime() + form.cooldownMinutes * 60 * 1000);
        if (nextAt > new Date()) {
          return res.status(429).json({
            success: false,
            error: "Cooldown active",
            retryAt: nextAt.toISOString(),
          });
        }
      }
    }

    const questionRecords: QuestionRecord[] = form.questions.map((q) => ({
      id: q.id,
      formId: q.formId,
      order: q.order,
      title: q.title,
      description: q.description,
      type: q.type,
      required: q.required,
      points: q.points,
      config: (q.config as any) ?? {},
    }));
    const answers: SubmittedAnswer[] = answersRaw
      .filter((a: any) => a && typeof a === "object")
      .map((a: any) => ({ questionId: String(a.questionId), value: a.value }));

    let result;
    try {
      result = markSubmission(form, questionRecords, answers);
    } catch (err: any) {
      if (err instanceof MarkingValidationError) {
        return res.status(400).json({ success: false, error: err.message, questionId: err.questionId });
      }
      console.error("[applications/submit] marking error", err);
      return res.status(500).json({ success: false, error: "Failed to mark submission" });
    }

    let finalStatus = result.status;
    let rankActionResult: any = null;
    const passRankId = (form as any).passRankId as bigint | null | undefined;
    if (
      result.passed &&
      finalStatus === "passed" &&
      form.rankActionEnabled &&
      passRankId !== null &&
      passRankId !== undefined
    ) {
      const ranked = await rankUser(workspaceId, userIdBig, passRankId);
      rankActionResult = ranked;
      if (ranked.attempted && !ranked.success) finalStatus = "action_failed";
    }

    let submission;
    try {
      submission = await prisma.applicationSubmission.create({
        data: {
          formId: form.id,
          workspaceGroupId: workspaceId,
          userId: userIdBig,
          username,
          answers: answers as any,
          score: result.score,
          maxScore: result.maxScore,
          percentage: result.percentage,
          passed: result.passed,
          status: finalStatus,
          markingBreakdown: { items: result.breakdown } as any,
          rankActionResult: rankActionResult as any,
        },
      });
    } catch (err) {
      console.error("[applications/submit] db error", err);
      return res.status(500).json({ success: false, error: "Failed to save submission" });
    }

    const message =
      finalStatus === "pending_review" ? "Application submitted for review"
      : finalStatus === "passed" ? "Application passed"
      : finalStatus === "action_failed" ? "Application graded but ranking failed"
      : "Application failed";

    return res.status(200).json({
      success: true,
      data: {
        submissionId: submission.id,
        status: finalStatus,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        passed: finalStatus === "passed",
        message,
      },
    });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withPublicApiRateLimit(handler);
