import type { pageWithLayout } from "@/layoutTypes";
import Workspace from "@/layouts/workspace";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { IconArrowLeft } from "@tabler/icons-react";
import moment from "moment";

interface Sub {
  id: string;
  userId: string;
  username: string | null;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  passed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  pending_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  action_failed: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const Submissions: pageWithLayout = () => {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get(`/api/workspace/${router.query.id}/applications/${router.query.formId}/submissions`, {
        params: filter ? { status: filter } : {},
      });
      setSubs(res.data.submissions);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (router.query.id && router.query.formId) load(); }, [router.query.id, router.query.formId, filter]);

  return (
    <div className="pagePadding">
      <Toaster position="bottom-center" />
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/workspace/${router.query.id}/applications`} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 flex-1">Submissions</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
          <option value="">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="action_failed">Action failed</option>
        </select>
      </div>

      {loading ? (
        <div className="text-zinc-500 dark:text-zinc-400">Loading…</div>
      ) : subs.length === 0 ? (
        <div className="text-zinc-500 dark:text-zinc-400">No submissions yet.</div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-zinc-500 bg-zinc-50 dark:bg-zinc-900/40">
              <tr>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Score</th>
                <th className="text-left px-4 py-2">Submitted</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-700/50">
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">
                    {s.username || s.userId}
                    <div className="text-xs text-zinc-400">{s.userId}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[s.status] || ""}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{s.score}/{s.maxScore} ({s.percentage}%)</td>
                  <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{moment(s.submittedAt).fromNow()}</td>
                  <td className="px-4 py-2 text-right">
                    <Link className="text-primary text-xs hover:underline"
                      href={`/workspace/${router.query.id}/applications/${router.query.formId}/submissions/${s.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

Submissions.layout = Workspace;
export default Submissions;
