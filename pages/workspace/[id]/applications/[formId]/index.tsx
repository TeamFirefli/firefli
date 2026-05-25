import type { pageWithLayout } from "@/layoutTypes";
import Workspace from "@/layouts/workspace";
import { workspacestate } from "@/state";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRecoilState } from "recoil";
import { useRouter } from "next/router";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import Button from "@/components/button";
import Link from "next/link";
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconEye,
  IconSettings,
  IconList,
  IconCheck,
  IconX,
  IconChevronDown,
} from "@tabler/icons-react";
import Tooltip from "@/components/tooltip";

type QType =
  | "short_text"
  | "free_text"
  | "paragraph"
  | "single_choice"
  | "multiple_choice"
  | "scale_slider"
  | "yes_no";

interface Question {
  id: string;
  formId: string;
  order: number;
  title: string;
  description: string | null;
  type: QType;
  required: boolean;
  points: number;
  config: any;
}

interface Form {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  passingScore: number | null;
  maxAttempts: number | null;
  cooldownMinutes: number | null;
  requireManualReview: boolean;
  allowRetake: boolean;
  rankActionEnabled: boolean;
  passRankId: string | null;
  requiredRankId: string | null;
  questions: Question[];
}

const TYPE_LABELS: Record<QType, string> = {
  short_text: "Short text",
  free_text: "Free text",
  paragraph: "Paragraph",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  scale_slider: "Scale slider",
  yes_no: "Yes / No",
};

const ApplicationBuilder: pageWithLayout = () => {
  const router = useRouter();
  const [workspace] = useRecoilState(workspacestate);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"questions" | "settings" | "preview">("questions");
  const [adding, setAdding] = useState(false);
  const [deleteConfirmQId, setDeleteConfirmQId] = useState<string | null>(null);
  const [deletingQ, setDeletingQ] = useState(false);

  const canManage = workspace.yourPermission?.includes("admin")
    || workspace.yourPermission?.includes("applications.manage");

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get(`/api/workspace/${router.query.id}/applications/${router.query.formId}`);
      setForm(res.data.form);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (router.query.id && router.query.formId) load();
  }, [router.query.id, router.query.formId]);

  async function patchForm(patch: Partial<Form>) {
    if (!form) return;
    setSaving(true);
    try {
      const res = await axios.patch(`/api/workspace/${router.query.id}/applications/${form.id}`, patch);
      setForm({ ...form, ...res.data.form, questions: form.questions });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function addQuestion(type: QType) {
    if (!form) return;
    setAdding(true);
    try {
      const defaults: any = {};
      if (type === "single_choice" || type === "multiple_choice") {
        defaults.choices = [
          { id: cryptoId(), label: "Option A" },
          { id: cryptoId(), label: "Option B" },
        ];
      } else if (type === "scale_slider") {
        defaults.min = 1; defaults.max = 5; defaults.step = 1; defaults.scaleMode = "exact";
      } else if (type === "yes_no") {
        defaults.correctBoolean = true;
      } else {
        defaults.textMode = "manual";
      }
      const res = await axios.post(`/api/workspace/${router.query.id}/applications/${form.id}/questions`, {
        title: "New question",
        type,
        required: true,
        points: 1,
        config: defaults,
      });
      setForm({ ...form, questions: [...form.questions, res.data.question] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function patchQuestion(qid: string, patch: Partial<Question>) {
    if (!form) return;
    try {
      const res = await axios.patch(`/api/workspace/${router.query.id}/applications/${form.id}/questions/${qid}`, patch);
      setForm({ ...form, questions: form.questions.map((q) => q.id === qid ? res.data.question : q) });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save question");
    }
  }

  async function confirmDeleteQuestion() {
    if (!form || !deleteConfirmQId) return;
    setDeletingQ(true);
    try {
      await axios.delete(`/api/workspace/${router.query.id}/applications/${form.id}/questions/${deleteConfirmQId}`);
      setForm({ ...form, questions: form.questions.filter((q) => q.id !== deleteConfirmQId) });
      setDeleteConfirmQId(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete");
    } finally {
      setDeletingQ(false);
    }
  }

  async function move(qid: string, dir: -1 | 1) {
    if (!form) return;
    const idx = form.questions.findIndex((q) => q.id === qid);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= form.questions.length) return;
    const next = form.questions.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setForm({ ...form, questions: next });
    try {
      await axios.patch(`/api/workspace/${router.query.id}/applications/${form.id}/questions/reorder`, {
        order: next.map((q) => q.id),
      });
    } catch (e: any) {
      toast.error("Failed to reorder");
      load();
    }
  }

  if (loading || !form) {
    return <div className="pagePadding text-zinc-500 dark:text-zinc-400">Loading…</div>;
  }

  return (
    <div className="pagePadding">
      <Toaster position="bottom-center" />
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/workspace/${router.query.id}/applications`} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <IconArrowLeft size={20} />
        </Link>
        <input
          className="bg-transparent text-2xl font-semibold text-zinc-900 dark:text-zinc-100 flex-1 outline-none rounded-lg pl-2 pr-1 focus:ring-2 focus:ring-primary"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={(e) => e.target.value !== "" && patchForm({ name: e.target.value })}
        />
        <span className={`text-xs px-2 py-1 rounded-full ${form.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"}`}>
          {form.enabled ? "Published" : "Draft"}
        </span>
        {canManage && (
          <Button workspace compact onPress={() => patchForm({ enabled: !form.enabled })} loading={saving}>
            {form.enabled ? "Unpublish" : "Publish"}
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-700">
        {[
          ["questions", "Questions", IconList],
          ["settings", "Settings", IconSettings],
          ["preview", "Preview", IconEye],
        ].map(([k, label, Icon]: any) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm flex items-center gap-1 border-b-2 -mb-px ${tab === k ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div>
          <div className="space-y-3 mb-6">
            {form.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                canManage={!!canManage}
                onChange={(patch) => patchQuestion(q.id, patch)}
                onDelete={() => setDeleteConfirmQId(q.id)}
                onMoveUp={() => move(q.id, -1)}
                onMoveDown={() => move(q.id, 1)}
              />
            ))}
            {form.questions.length === 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">No questions yet. Add one below.</div>
            )}
          </div>
          {canManage && (
            <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-3">Add question</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_LABELS) as QType[]).map((t) => (
                  <button
                    key={t}
                    disabled={adding}
                    onClick={() => addQuestion(t)}
                    className="px-3 py-1.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <IconPlus size={13} /> {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <SettingsPanel form={form} onSave={patchForm} canManage={!!canManage} saving={saving} />
      )}

      {tab === "preview" && <PreviewPanel form={form} />}

      {deleteConfirmQId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Confirm Deletion
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete this question?
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setDeleteConfirmQId(null)}
                disabled={deletingQ}
                className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteQuestion}
                disabled={deletingQ}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deletingQ ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function cryptoId() {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
}

function TypeSelect({ value, onChange, disabled }: { value: QType; onChange: (t: QType) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm pl-3 pr-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {TYPE_LABELS[value]}
        <IconChevronDown size={14} className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[10rem] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden py-1">
          {(Object.entries(TYPE_LABELS) as [QType, string][]).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => { onChange(v); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                v === value
                  ? "text-primary bg-primary/8 font-medium"
                  : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ question, index, canManage, onChange, onDelete, onMoveUp, onMoveDown }: {
  question: Question; index: number; canManage: boolean;
  onChange: (patch: Partial<Question>) => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [local, setLocal] = useState(question);
  useEffect(() => setLocal(question), [question.id]);

  function commit<K extends keyof Question>(key: K, value: Question[K]) {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange({ [key]: value } as any);
  }

  function commitConfig(patch: any) {
    const cfg = { ...(local.config || {}), ...patch };
    setLocal({ ...local, config: cfg });
    onChange({ config: cfg });
  }

  function changeType(newType: QType) {
    let defaults: any = {};
    if (newType === "single_choice" || newType === "multiple_choice") {
      defaults = { choices: [{ id: cryptoId(), label: "Option A" }, { id: cryptoId(), label: "Option B" }] };
    } else if (newType === "scale_slider") {
      defaults = { min: 1, max: 5, step: 1, scaleMode: "exact" };
    } else if (newType === "yes_no") {
      defaults = { correctBoolean: undefined };
    } else {
      defaults = { textMode: "manual" };
    }
    const next = { ...local, type: newType, config: defaults };
    setLocal(next);
    onChange({ type: newType, config: defaults });
  }

  return (
    <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-sm overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-2xl" />
      <div className="pl-6 pr-4 pt-5 pb-4">
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
              Question {index + 1}
            </div>
            <input
              className="w-full text-[15px] font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              placeholder="Question title"
              value={local.title}
              disabled={!canManage}
              onChange={(e) => setLocal({ ...local, title: e.target.value })}
              onBlur={(e) => e.target.value && commit("title", e.target.value)}
            />
            <input
              placeholder="Description (optional)"
              className="mt-2 w-full text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
              value={local.description ?? ""}
              disabled={!canManage}
              onChange={(e) => setLocal({ ...local, description: e.target.value })}
              onBlur={(e) => commit("description", e.target.value || null)}
            />
          </div>
          <TypeSelect value={local.type} onChange={changeType} disabled={!canManage} />
        </div>
        <ConfigEditor question={local} canManage={canManage} onChange={commitConfig} />
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-4 flex-wrap">
          <button
            type="button"
            role="switch"
            aria-checked={local.required}
            disabled={!canManage}
            onClick={() => commit("required", !local.required)}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 disabled:opacity-60"
          >
            <div
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                local.required ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  local.required ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
            <span>Required</span>
          </button>

          {/* Points */}
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span>Points</span>
            <input
              type="number"
              min={0}
              className="w-14 text-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              value={local.points}
              disabled={!canManage}
              onChange={(e) => setLocal({ ...local, points: Number(e.target.value) })}
              onBlur={(e) => commit("points", Math.max(0, Number(e.target.value) || 0))}
            />
          </div>

          <div className="flex-1" />

          {canManage && (
            <div className="flex items-center gap-0.5">
              <Tooltip orientation="top" tooltipText="Move up">
                <button
                  onClick={onMoveUp}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <IconArrowUp size={16} />
                </button>
              </Tooltip>
              <Tooltip orientation="top" tooltipText="Move down">
                <button
                  onClick={onMoveDown}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <IconArrowDown size={16} />
                </button>
              </Tooltip>
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />
              <Tooltip orientation="top" tooltipText="Delete question">
                <button
                  onClick={onDelete}
                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <IconTrash size={16} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigEditor({ question, canManage, onChange }: {
  question: Question; canManage: boolean; onChange: (patch: any) => void;
}) {
  const cfg = question.config || {};
  const t = question.type as QType;
  const SECTION = "mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800";
  const INPUT = "px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
  const NUM = "w-20 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 text-center focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
  const SECTION_LABEL = "text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3";
  if (t === "single_choice" || t === "multiple_choice") {
    const choices: Array<{ id: string; label: string }> = cfg.choices || [];
    const correctIds: string[] = cfg.correctChoiceIds || [];
    return (
      <div className={SECTION}>
        <p className={SECTION_LABEL}>
          Options:
          <span className="normal-case font-normal text-zinc-400 dark:text-zinc-500 ml-1">
             click the {t === "single_choice" ? "circle" : "square"} to mark correct
          </span>
        </p>
        <div className="space-y-2.5">
          {choices.map((c, i) => {
            const isCorrect = correctIds.includes(c.id);
            return (
              <div key={c.id} className="flex items-center gap-2.5 group/choice">
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    let next: string[];
                    if (t === "single_choice") next = isCorrect ? [] : [c.id];
                    else next = isCorrect ? correctIds.filter((x) => x !== c.id) : [...correctIds, c.id];
                    onChange({ correctChoiceIds: next });
                  }}
                  title={isCorrect ? "Correct answer" : "Mark as correct"}
                  className={`shrink-0 flex items-center justify-center transition-all border-2 ${
                    t === "single_choice" ? "w-5 h-5 rounded-full" : "w-5 h-5 rounded"
                  } ${
                    isCorrect
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-300 dark:border-zinc-600 hover:border-emerald-400 dark:hover:border-emerald-500"
                  } disabled:cursor-not-allowed`}
                >
                  {isCorrect && <IconCheck size={11} strokeWidth={3} />}
                </button>
                <input
                  className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  value={c.label}
                  disabled={!canManage}
                  onChange={(e) => {
                    const next = choices.slice();
                    next[i] = { ...c, label: e.target.value };
                    onChange({ choices: next });
                  }}
                />
                {canManage && choices.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange({
                      choices: choices.filter((_, j) => j !== i),
                      correctChoiceIds: correctIds.filter((x) => x !== c.id),
                    })}
                    className="shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover/choice:opacity-100"
                  >
                    <IconX size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => onChange({ choices: [...choices, { id: cryptoId(), label: `Option ${String.fromCharCode(65 + choices.length)}` }] })}
            className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <IconPlus size={14} /> Add option
          </button>
        )}
        {t === "multiple_choice" && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Marking</span>
            <select
              className="text-xs px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              value={cfg.multipleChoiceMode ?? "exact"}
              disabled={!canManage}
              onChange={(e) => onChange({ multipleChoiceMode: e.target.value })}
            >
              <option value="exact">Exact match</option>
              <option value="partial">Partial credit</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  if (t === "scale_slider") {
    return (
      <div className={SECTION + " space-y-4"}>
        <div>
          <p className={SECTION_LABEL}>Scale range</p>
          <div className="flex flex-wrap gap-4">
            {([
              ["Min", "min", 1],
              ["Max", "max", 5],
              ["Step", "step", 1],
            ] as [string, string, number][]).map(([label, key, def]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
                <input type="number" className={NUM} disabled={!canManage}
                  value={cfg[key] ?? def}
                  onChange={(e) => onChange({ [key]: Number(e.target.value) })} />
              </div>
            ))}
            {([
              ["Min label", "minLabel", "e.g. Low"],
              ["Max label", "maxLabel", "e.g. High"],
            ] as [string, string, string][]).map(([label, key, ph]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
                <input
                  className={`w-28 ${INPUT}`}
                  disabled={!canManage}
                  placeholder={ph}
                  value={cfg[key] ?? ""}
                  onChange={(e) => onChange({ [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className={SECTION_LABEL}>Correct answer mode</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Mode</span>
              <select className={INPUT} disabled={!canManage} value={cfg.scaleMode ?? "exact"} onChange={(e) => onChange({ scaleMode: e.target.value })}>
                <option value="exact">Exact value</option>
                <option value="range">Accepted range</option>
                <option value="bands">Bands</option>
              </select>
            </div>
            {(!cfg.scaleMode || cfg.scaleMode === "exact") && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Correct value</span>
                <input type="number" className={NUM} disabled={!canManage} value={cfg.exactValue ?? ""} onChange={(e) => onChange({ exactValue: Number(e.target.value) })} />
              </div>
            )}
            {cfg.scaleMode === "range" && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">From</span>
                  <input type="number" className={NUM} disabled={!canManage} value={cfg.rangeMin ?? 0} onChange={(e) => onChange({ rangeMin: Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">To</span>
                  <input type="number" className={NUM} disabled={!canManage} value={cfg.rangeMax ?? 0} onChange={(e) => onChange({ rangeMax: Number(e.target.value) })} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (t === "yes_no") {
    const current = cfg.correctBoolean === undefined ? "" : cfg.correctBoolean ? "yes" : "no";
    return (
      <div className={SECTION}>
        <p className={SECTION_LABEL}>Correct answer:</p>
        <div className="flex gap-2">
          {[
            { value: "yes", label: "Yes", bool: true },
            { value: "no", label: "No", bool: false },
            { value: "", label: "Manual", bool: undefined },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!canManage}
              onClick={() => onChange({ correctBoolean: opt.bool })}
              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                current === opt.value
                  ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-500"
              } disabled:opacity-60`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={SECTION + " space-y-4"}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Marking mode</span>
        <select
          className={`text-sm ${INPUT}`}
          disabled={!canManage}
          value={cfg.textMode ?? "manual"}
          onChange={(e) => onChange({ textMode: e.target.value })}
        >
          <option value="manual">Manual review</option>
          <option value="accepted_list">Accepted answers</option>
          <option value="keywords">Keywords</option>
        </select>
      </div>

      {cfg.textMode === "accepted_list" && (
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
            Accepted answers
            <span className="text-zinc-400 dark:text-zinc-500 ml-1">(one per line)</span>
          </p>
          <textarea
            className={`w-full resize-none ${INPUT}`}
            rows={4}
            disabled={!canManage}
            placeholder={"Answer 1\nAnswer 2\nAnswer 3"}
            value={(cfg.acceptedAnswers || []).join("\n")}
            onChange={(e) => onChange({ acceptedAnswers: e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean) })}
          />
        </div>
      )}

      {cfg.textMode === "keywords" && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
              Keywords <span className="text-zinc-400 dark:text-zinc-500">(comma separated)</span>
            </p>
            <input
              className={`w-full ${INPUT}`}
              disabled={!canManage}
              placeholder="word1, word2, phrase"
              value={(cfg.keywords || []).join(", ")}
              onChange={(e) => onChange({ keywords: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Rule</span>
            <select
              className={`text-sm ${INPUT}`}
              disabled={!canManage}
              value={cfg.keywordRule ?? "any"}
              onChange={(e) => onChange({ keywordRule: e.target.value })}
            >
              <option value="any">Any keyword matches</option>
              <option value="all">All keywords required</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center pt-1">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={!!cfg.caseSensitive}
            onChange={(e) => onChange({ caseSensitive: e.target.checked })}
            className="accent-primary"
          />
          Case sensitive
        </label>
        {[
          ["Min length", "minLength"],
          ["Max length", "maxLength"],
        ].map(([label, key]) => (
          <div key={key} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span>{label}</span>
            <input
              type="number"
              className="w-16 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-center text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              disabled={!canManage}
              value={cfg[key] ?? ""}
              onChange={(e) => onChange({ [key]: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingToggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 w-full disabled:opacity-60 group text-left"
    >
      <div>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>}
      </div>
      <div className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${checked ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-600"}`}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

function RankSelect({ value, onChange, disabled, ranks, placeholder }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean; ranks: Array<{ id: number; name: string; rank: number }>; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);
  const selected = ranks.find((r) => String(r.id) === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-sm pl-3 pr-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? "" : "text-zinc-400 dark:text-zinc-500"}>{selected ? `${selected.name} (rank ${selected.rank})` : placeholder}</span>
        <IconChevronDown size={14} className={`shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto">
          <button type="button" onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${!value ? "text-primary bg-primary/8 font-medium" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/60"}`}>
            {placeholder}
          </button>
          {ranks.map((r) => (
            <button key={r.id} type="button" onClick={() => { onChange(String(r.id)); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${String(r.id) === value ? "text-primary bg-primary/8 font-medium" : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60"}`}>
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ form, onSave, canManage, saving }: { form: Form; onSave: (p: Partial<Form>) => void; canManage: boolean; saving: boolean }) {
  const [local, setLocal] = useState(form);
  const [ranks, setRanks] = useState<Array<{ id: number; name: string; rank: number }>>([]);
  const router = useRouter();
  useEffect(() => setLocal(form), [form.id]);
  useEffect(() => {
    const wsId = router.query.id;
    if (!wsId) return;
    axios.get(`/api/workspace/${wsId}/ranks`).then((r) => {
      if (r.data?.success) setRanks(r.data.ranks || []);
    }).catch(() => {});
  }, [router.query.id]);
  const set = (k: keyof Form, v: any) => setLocal({ ...local, [k]: v });

  const FIELD_LABEL = "text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1.5 block";
  const INPUT = "w-full text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-50";

  return (
    <div className="max-w-2xl space-y-3">
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-2xl" />
        <div className="pl-6 pr-4 pt-5 pb-5 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">General</p>
          <div>
            <label className={FIELD_LABEL}>Description</label>
            <textarea className={INPUT} rows={2} value={local.description ?? ""} disabled={!canManage}
              onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={FIELD_LABEL}>Passing score (%)</label>
              <input type="number" className={INPUT} value={local.passingScore ?? ""} disabled={!canManage}
                placeholder="e.g. 70"
                onChange={(e) => set("passingScore", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Max attempts</label>
              <input type="number" className={INPUT} value={local.maxAttempts ?? ""} disabled={!canManage}
                placeholder="Unlimited"
                onChange={(e) => set("maxAttempts", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Cooldown (minutes)</label>
              <input type="number" className={INPUT} value={local.cooldownMinutes ?? ""} disabled={!canManage}
                placeholder="None"
                onChange={(e) => set("cooldownMinutes", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-2xl" />
        <div className="pl-6 pr-4 pt-5 pb-5 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Access</p>
          <div>
            <label className={FIELD_LABEL}>Minimum rank to take this application</label>
            <RankSelect value={local.requiredRankId} onChange={(v) => set("requiredRankId", v)} disabled={!canManage} ranks={ranks} placeholder="No restriction" />
          </div>
        </div>
      </div>

      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-2xl" />
        <div className="pl-6 pr-4 pt-5 pb-5 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Behaviour</p>
          <SettingToggle label="Require manual review" description="Submissions must be approved by a manager before passing." checked={local.requireManualReview} onChange={(v) => set("requireManualReview", v)} disabled={!canManage} />
          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
          <SettingToggle label="Allow retakes" description="Players can resubmit after a failed attempt." checked={local.allowRetake} onChange={(v) => set("allowRetake", v)} disabled={!canManage} />
          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
          <SettingToggle label="Rank automatically on pass" description="Assign a rank group when a player's submission passes." checked={local.rankActionEnabled} onChange={(v) => set("rankActionEnabled", v)} disabled={!canManage} />
          {local.rankActionEnabled && (
            <div>
              <label className={FIELD_LABEL}>Rank given on pass</label>
              <RankSelect value={local.passRankId} onChange={(v) => set("passRankId", v)} disabled={!canManage} ranks={ranks} placeholder="Select a rank…" />
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <Button workspace onPress={() => onSave({
          description: local.description, passingScore: local.passingScore,
          maxAttempts: local.maxAttempts, cooldownMinutes: local.cooldownMinutes,
          requireManualReview: local.requireManualReview, allowRetake: local.allowRetake,
          rankActionEnabled: local.rankActionEnabled, passRankId: local.passRankId, requiredRankId: local.requiredRankId,
        })} loading={saving}>Save settings</Button>
      )}
    </div>
  );
}

function PreviewPanel({ form }: { form: Form }) {
  return (
    <div className="max-w-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{form.name}</h2>
      {form.description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{form.description}</p>}
      <div className="mt-4 space-y-4">
        {form.questions.map((q, i) => (
          <div key={q.id}>
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{i + 1}. {q.title}{q.required && <span className="text-red-500">*</span>}</div>
            {q.description && <div className="text-xs text-zinc-500 dark:text-zinc-400">{q.description}</div>}
            <div className="mt-2 text-xs text-zinc-400 italic">[{TYPE_LABELS[q.type as QType]}]</div>
          </div>
        ))}
      </div>
    </div>
  );
}

ApplicationBuilder.layout = Workspace;
export default ApplicationBuilder;
