import type { pageWithLayout } from "@/layoutTypes";
import Workspace from "@/layouts/workspace";
import { workspacestate } from "@/state";
import { useRecoilState } from "recoil";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import Button from "@/components/button";
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import moment from "moment";

const SubmissionView: pageWithLayout = () => {
  const router = useRouter();
  const [workspace] = useRecoilState(workspacestate);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("");
  const canReview = workspace.yourPermission?.includes("admin") || workspace.yourPermission?.includes("applications.review");

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get(`/api/workspace/${router.query.id}/applications/${router.query.formId}/submissions/${router.query.submissionId}`);
      setSubmission(res.data.submission);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (router.query.submissionId) load(); }, [router.query.submissionId]);

  async function review(passed: boolean) {
    setReviewing(true);
    try {
      await axios.patch(
        `/api/workspace/${router.query.id}/applications/${router.query.formId}/submissions/${router.query.submissionId}/review`,
        { passed, note }
      );
      toast.success(passed ? "Marked as passed" : "Marked as failed");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setReviewing(false);
    }
  }

  if (loading || !submission) return <div className="pagePadding text-zinc-500">Loading…</div>;

  const answers = submission.answers as Array<{ questionId: string; value: any }>;
  const breakdown = submission.markingBreakdown?.items || [];
  const questions = submission.form.questions;

  return (
    <div className="pagePadding">
      <Toaster position="bottom-center" />
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/workspace/${router.query.id}/applications/${router.query.formId}/submissions`} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 flex-1">
          {submission.username || submission.userId}
        </h1>
        <span className="text-sm text-zinc-500">{submission.score}/{submission.maxScore} ({submission.percentage}%)</span>
        <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-700">{submission.status}</span>
      </div>

      <p className="text-sm text-zinc-500 mb-6">Submitted {moment(submission.submittedAt).format("LLL")}</p>

      <div className="space-y-3">
        {questions.map((q: any, i: number) => {
          const a = answers.find((x) => x.questionId === q.id);
          const b = breakdown.find((x: any) => x.questionId === q.id);
          return (
            <div key={q.id} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{i + 1}. {q.title}</div>
                {b && (
                  <span className="text-xs text-zinc-500">
                    {b.awardedPoints}/{b.maxPoints} {b.correct === true && <IconCheck size={12} className="inline text-emerald-500" />}{b.correct === false && <IconX size={12} className="inline text-red-500" />}
                  </span>
                )}
              </div>
              <div className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">
                {a ? JSON.stringify(a.value) : <span className="text-zinc-400 italic">no answer</span>}
              </div>
              {b?.notes && <div className="text-xs text-zinc-400 mt-1">{b.notes}</div>}
            </div>
          );
        })}
      </div>

      {submission.status === "pending_review" && canReview && (
        <div className="mt-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Review</h3>
          <textarea
            placeholder="Review note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm mb-3"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => review(false)} disabled={reviewing} className="px-4 py-2 text-sm rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 disabled:opacity-50">Reject</button>
            <Button workspace onPress={() => review(true)} loading={reviewing}>Approve</Button>
          </div>
        </div>
      )}

      {submission.rankActionResult && (
        <div className="mt-6 text-xs text-zinc-500">
          <strong>Rank action:</strong> {JSON.stringify(submission.rankActionResult)}
        </div>
      )}
    </div>
  );
};

SubmissionView.layout = Workspace;
export default SubmissionView;
