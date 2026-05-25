import type { pageWithLayout } from "@/layoutTypes";
import Workspace from "@/layouts/workspace";
import { workspacestate } from "@/state";
import { useEffect, useState } from "react";
import { useRecoilState } from "recoil";
import axios from "axios";
import { useRouter } from "next/router";
import toast, { Toaster } from "react-hot-toast";
import Button from "@/components/button";
import {
  IconPlus,
  IconFileText,
  IconEye,
  IconTrash,
  IconCheck,
  IconX,
} from "@tabler/icons-react";

interface FormSummary {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  passingScore: number | null;
  _count: { questions: number; submissions: number };
}

const ApplicationsList: pageWithLayout = () => {
  const router = useRouter();
  const [workspace] = useRecoilState(workspacestate);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const canManage = workspace.yourPermission?.includes("admin") || workspace.yourPermission?.includes("applications.manage");

  async function refresh() {
    setLoading(true);
    try {
      const res = await axios.get(`/api/workspace/${router.query.id}/applications`);
      setForms(res.data.forms || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (router.query.id) refresh();
  }, [router.query.id]);

  async function createForm() {
    if (!newName.trim()) return toast.error("Name required");
    setCreating(true);
    try {
      const res = await axios.post(`/api/workspace/${router.query.id}/applications`, {
        name: newName.trim(),
        description: newDesc.trim() || null,
      });
      toast.success("Application created");
      setShowNew(false);
      setNewName("");
      setNewDesc("");
      router.push(`/workspace/${router.query.id}/applications/${res.data.form.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function deleteForm(id: string) {
    if (!confirm("Delete this application form? This cannot be undone.")) return;
    try {
      await axios.delete(`/api/workspace/${router.query.id}/applications/${id}`);
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete");
    }
  }

  return (
    <div className="pagePadding">
      <Toaster position="bottom-center" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Application Centre</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Build forms players can fill out in-game.</p>
        </div>
        {canManage && (
          <Button workspace onPress={() => setShowNew(true)}>
            <span className="flex items-center gap-1"><IconPlus size={16} /> New form</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-zinc-500 dark:text-zinc-400">Loading…</div>
      ) : forms.length === 0 ? (
        <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-10 text-center">
          <IconFileText className="mx-auto text-zinc-400" size={32} />
          <p className="mt-2 text-zinc-600 dark:text-zinc-300">No applications yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((f) => (
            <div
              key={f.id}
              className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{f.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    f.enabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {f.enabled ? <><IconCheck size={10} className="inline" /> Published</> : <><IconX size={10} className="inline" /> Draft</>}
                </span>
              </div>
              {f.description && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{f.description}</p>
              )}
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex gap-3">
                <span>{f._count.questions} questions</span>
                <span>{f._count.submissions} submissions</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 px-3 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200"
                  onClick={() => router.push(`/workspace/${router.query.id}/applications/${f.id}`)}
                >
                  Edit
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200"
                  onClick={() => router.push(`/workspace/${router.query.id}/applications/${f.id}/submissions`)}
                >
                  <IconEye size={14} />
                </button>
                {canManage && (
                  <button
                    className="px-3 py-1.5 text-sm rounded-md bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300"
                    onClick={() => deleteForm(f.id)}
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">New application form</h2>
            <label className="block text-sm text-zinc-600 dark:text-zinc-300 mb-1">Name</label>
            <input
              className="w-full mb-3 px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Moderator Application"
            />
            <label className="block text-sm text-zinc-600 dark:text-zinc-300 mb-1">Description</label>
            <textarea
              className="w-full mb-3 px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end mt-2">
              <button
                className="px-4 py-2 text-sm rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </button>
              <Button workspace onPress={createForm} loading={creating}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ApplicationsList.layout = Workspace;
export default ApplicationsList;
