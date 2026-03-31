import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import {
  IconUserShield,
  IconPlus,
  IconPencil,
  IconTrash,
  IconCheck,
  IconX,
  IconShield,
  IconFolder,
  IconRefresh,
  IconArchive,
  IconArrowBackUp,
  IconChevronDown,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

type RoleCategory = {
  id: string;
  name: string;
  archived?: boolean;
};

type RoleTemplate = {
  id: string;
  name: string;
  categoryId: string | null;
  category: RoleCategory | null;
  hostRole: "primary" | "secondary" | null;
  slots: number;
  groupRoles: number[];
  archived?: boolean;
};

type WorkspaceRole = {
  id: string;
  name: string;
  groupRoles: number[];
  color?: string;
};

const UNCATEGORISED = "__uncategorised__";

const SessionRoles = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [categories, setCategories] = useState<RoleCategory[]>([]);
  const [workspaceRoles, setWorkspaceRoles] = useState<WorkspaceRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Archived state ─────────────────────────────────────────────────────────
  const [archivedTemplates, setArchivedTemplates] = useState<RoleTemplate[]>([]);
  const [archivedCategories, setArchivedCategories] = useState<RoleCategory[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [legacySlotsCount, setLegacySlotsCount] = useState(0);
  const [isPatching, setIsPatching] = useState(false);
  const [patchableCount, setPatchableCount] = useState(0);

  // ── Category management state ──────────────────────────────────────────────
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [deleteCatConfirmId, setDeleteCatConfirmId] = useState<string | null>(null);

  // ── Template management state ──────────────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<string>("");
  const [newHostRole, setNewHostRole] = useState<"primary" | "secondary" | "">("");
  const [newSlots, setNewSlots] = useState(1);
  const [newGroupRoles, setNewGroupRoles] = useState<number[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editHostRole, setEditHostRole] = useState<"primary" | "secondary" | "">("");
  const [editSlots, setEditSlots] = useState(1);
  const [editGroupRoles, setEditGroupRoles] = useState<number[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!router.query.id) return;
    fetchData();
  }, [router.query.id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [templatesRes, catsRes, rolesRes, archivedTplRes, archivedCatRes, convertRes] = await Promise.all([
        axios.get(`/api/workspace/${router.query.id}/settings/sessions/rtemplates`),
        axios.get(`/api/workspace/${router.query.id}/settings/sessions/rcategories`),
        axios.get(`/api/workspace/${router.query.id}/settings/roles`),
        axios.get(`/api/workspace/${router.query.id}/settings/sessions/rtemplates?archived=1`),
        axios.get(`/api/workspace/${router.query.id}/settings/sessions/rcategories?archived=1`),
        axios.get(`/api/workspace/${router.query.id}/settings/sessions/rtemplates/convert`),
      ]);
      if (templatesRes.data.success) setTemplates(templatesRes.data.templates || []);
      if (catsRes.data.success) setCategories(catsRes.data.categories || []);
      if (rolesRes.data.success) setWorkspaceRoles(rolesRes.data.roles || []);
      if (archivedTplRes.data.success) setArchivedTemplates(archivedTplRes.data.templates || []);
      if (archivedCatRes.data.success) setArchivedCategories(archivedCatRes.data.categories || []);
      if (convertRes.data.success) setLegacySlotsCount(convertRes.data.importable ?? 0);
        const patchRes = await axios.get(`/api/workspace/${router.query.id}/settings/sessions/rtemplates/convert?action=patch-host-roles`);
        if (patchRes.data.success) setPatchableCount(patchRes.data.patchable ?? 0);
    } catch {
      toast.error("Failed to load session roles");
    } finally {
      setIsLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, RoleTemplate[]>();
    for (const t of templates) {
      const key = t.categoryId || UNCATEGORISED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    // Sort: named categories alphabetically, uncategorised last
    const catOrder = new Map(categories.map((c) => [c.id, c.name]));
    return [...map.entries()].sort(([a], [b]) => {
      if (a === UNCATEGORISED) return 1;
      if (b === UNCATEGORISED) return -1;
      return (catOrder.get(a) ?? "").localeCompare(catOrder.get(b) ?? "");
    });
  }, [templates, categories]);

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const handleConvert = async () => {
    setIsConverting(true);
    try {
      const res = await axios.post(
        `/api/workspace/${router.query.id}/settings/sessions/rtemplates/convert`
      );
      if (res.data.success) {
        if (res.data.created === 0) {
          toast.success("No new roles to import — all slot names already exist as templates.");
        } else {
          setTemplates((prev) => [...prev, ...(res.data.templates || [])]);
          toast.success(`Imported ${res.data.created} role template${res.data.created !== 1 ? "s" : ""} from legacy slot definitions.`);
        }
        setLegacySlotsCount(0);
      }
    } catch {
      toast.error("Failed to import legacy slots");
    } finally {
      setIsConverting(false);
    }
  };

  const handlePatchHostRoles = async () => {
    setIsPatching(true);
    try {
      const res = await axios.post(
        `/api/workspace/${router.query.id}/settings/sessions/rtemplates/convert`,
        { action: "patch-host-roles" }
      );
      if (res.data.success) {
        if (res.data.patched === 0) {
          toast.success("No slots needed patching — all active session roles already have host role set.");
        } else {
          toast.success(`Updated host role on ${res.data.patched} slot${res.data.patched !== 1 ? "s" : ""} in active sessions.`);
        }
        setPatchableCount(0);
      }
    } catch {
      toast.error("Failed to patch host roles");
    } finally {
      setIsPatching(false);
    }
  };

  const handleRestoreTemplate = async (id: string) => {
    try {
      const res = await axios.patch(
        `/api/workspace/${router.query.id}/settings/sessions/rtemplates/${id}`,
        { archived: false }
      );
      if (res.data.success) {
        setArchivedTemplates((prev) => prev.filter((t) => t.id !== id));
        setTemplates((prev) => [...prev, res.data.template]);
        toast.success("Role restored");
      }
    } catch { toast.error("Failed to restore role"); }
  };

  const handleRestoreCategory = async (id: string) => {
    try {
      const res = await axios.patch(
        `/api/workspace/${router.query.id}/settings/sessions/rcategories/${id}`,
        { archived: false }
      );
      if (res.data.success) {
        setArchivedCategories((prev) => prev.filter((c) => c.id !== id));
        setCategories((prev) => [...prev, res.data.category].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Category restored");
      }
    } catch { toast.error("Failed to restore category"); }
  };

  const handleCreateCat = async () => {
    if (!newCatName.trim()) { toast.error("Category name is required"); return; }
    setIsSavingCat(true);
    try {
      const res = await axios.post(
        `/api/workspace/${router.query.id}/settings/sessions/rcategories`,
        { name: newCatName.trim() }
      );
      if (res.data.success) {
        setCategories((prev) => [...prev, res.data.category].sort((a, b) => a.name.localeCompare(b.name)));
        setNewCatName("");
        setIsAddingCat(false);
        toast.success("Category created");
      }
    } catch { toast.error("Failed to create category"); }
    finally { setIsSavingCat(false); }
  };

  const handleSaveCatEdit = async () => {
    if (!editCatName.trim()) { toast.error("Category name is required"); return; }
    try {
      const res = await axios.patch(
        `/api/workspace/${router.query.id}/settings/sessions/rcategories/${editingCatId}`,
        { name: editCatName.trim() }
      );
      if (res.data.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCatId ? res.data.category : c))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingCatId(null);
        toast.success("Category renamed");
      }
    } catch { toast.error("Failed to rename category"); }
  };

  const handleDeleteCat = async (id: string) => {
    try {
      const res = await axios.delete(`/api/workspace/${router.query.id}/settings/sessions/rcategories/${id}`);
      if (res.data.archived) {
        const cat = categories.find((c) => c.id === id);
        if (cat) setArchivedCategories((prev) => [...prev, { ...cat, archived: true }]);
        toast.success("Category archived (in use by sessions)");
      } else {
        toast.success("Category deleted");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setDeleteCatConfirmId(null);
    } catch { toast.error("Failed to delete category"); }
  };

  // ── Template CRUD ──────────────────────────────────────────────────────────
  const toggleGroupRole = (roleId: number, current: number[], setter: (v: number[]) => void) => {
    setter(current.includes(roleId) ? current.filter((r) => r !== roleId) : [...current, roleId]);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Role name is required"); return; }
    setIsSaving(true);
    try {
      const res = await axios.post(
        `/api/workspace/${router.query.id}/settings/sessions/rtemplates`,
        {
          name: newName.trim(),
          categoryId: newCategoryId || null,
          hostRole: newHostRole || null,
          slots: newSlots,
          groupRoles: newGroupRoles,
        }
      );
      if (res.data.success) {
        setTemplates((prev) => [...prev, res.data.template]);
        setNewName(""); setNewCategoryId(""); setNewHostRole(""); setNewSlots(1); setNewGroupRoles([]);
        setIsAdding(false);
        toast.success("Session role created");
      }
    } catch { toast.error("Failed to create session role"); }
    finally { setIsSaving(false); }
  };

  const startEdit = (template: RoleTemplate) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditCategoryId(template.categoryId || "");
    setEditHostRole(template.hostRole || "");
    setEditSlots(template.slots);
    setEditGroupRoles(template.groupRoles || []);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { toast.error("Role name is required"); return; }
    setIsSavingEdit(true);
    try {
      const res = await axios.patch(
        `/api/workspace/${router.query.id}/settings/sessions/rtemplates/${editingId}`,
        {
          name: editName.trim(),
          categoryId: editCategoryId || null,
          hostRole: editHostRole || null,
          slots: editSlots,
          groupRoles: editGroupRoles,
        }
      );
      if (res.data.success) {
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? res.data.template : t)));
        setEditingId(null);
        toast.success("Session role updated");
      }
    } catch { toast.error("Failed to update session role"); }
    finally { setIsSavingEdit(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axios.delete(`/api/workspace/${router.query.id}/settings/sessions/rtemplates/${id}`);
      if (res.data.archived) {
        const tpl = templates.find((t) => t.id === id);
        if (tpl) setArchivedTemplates((prev) => [...prev, { ...tpl, archived: true }]);
        toast.success("Role archived (in use by sessions)");
      } else {
        toast.success("Role deleted");
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirmId(null);
    } catch { toast.error("Failed to delete session role"); }
  };

  const getRoleNames = (groupRoleIds: number[]) => {
    if (!groupRoleIds || groupRoleIds.length === 0) return null;
    const names = workspaceRoles
      .filter((wr) => wr.groupRoles.some((gr) => groupRoleIds.includes(gr)))
      .map((wr) => wr.name);
    return names.length ? names.join(", ") : null;
  };

  const GroupRolePicker = ({ selected, onToggle }: { selected: number[]; onToggle: (id: number) => void }) => {
    if (workspaceRoles.length === 0) {
      return <p className="text-xs text-zinc-500 dark:text-zinc-400">No workspace roles defined. Create roles in Settings → Permissions first.</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {workspaceRoles.map((wr) => {
          const isActive = wr.groupRoles.some((gr) => selected.includes(gr));
          return (
            <button key={wr.id} type="button"
              onClick={() => wr.groupRoles.forEach((gr) => { if (isActive !== selected.includes(gr)) return; onToggle(gr); })}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${isActive
                ? "bg-primary/10 border-primary text-primary"
                : "bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"}`}
            >
              {wr.name}
            </button>
          );
        })}
      </div>
    );
  };

  const CategorySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
    >
      <option value="">— None —</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <IconUserShield size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Session Roles</h3>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Define reusable role presets for sessions. When creating a session, you can toggle these on/off.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {legacySlotsCount > 0 && (
            <button
              onClick={handleConvert}
              disabled={isConverting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50 transition-colors"
              title="Import role names from legacy slot definitions on session types"
            >
              <IconRefresh size={14} className={isConverting ? "animate-spin" : ""} />
              {isConverting ? "Importing…" : `Import ${legacySlotsCount} legacy slot${legacySlotsCount !== 1 ? "s" : ""}`}
            </button>
          )}
          {patchableCount > 0 && (
            <button
              onClick={handlePatchHostRoles}
              disabled={isPatching}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
              title="Back-fill host role on slots in active/ended non-archived sessions to fix quota counts"
            >
              <IconRefresh size={14} className={isPatching ? "animate-spin" : ""} />
              {isPatching ? "Patching…" : `Fix host roles on ${patchableCount} active slot${patchableCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconFolder size={16} className="text-zinc-500 dark:text-zinc-400" />
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Categories</h4>
              </div>
              {!isAddingCat && (
                <button
                  onClick={() => setIsAddingCat(true)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                >
                  <IconPlus size={12} /> Add category
                </button>
              )}
            </div>

            {categories.length === 0 && !isAddingCat && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No categories yet. Categories help group roles.</p>
            )}

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) =>
                editingCatId === cat.id ? (
                  <div key={cat.id} className="flex items-center gap-1">
                    <input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      maxLength={64}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveCatEdit(); if (e.key === "Escape") setEditingCatId(null); }}
                      autoFocus
                      className="px-2 py-1 text-xs border border-primary rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary w-36"
                    />
                    <button onClick={handleSaveCatEdit} className="p-1 text-primary hover:text-primary/70"><IconCheck size={14} /></button>
                    <button onClick={() => setEditingCatId(null)} className="p-1 text-zinc-400 hover:text-zinc-600"><IconX size={14} /></button>
                  </div>
                ) : deleteCatConfirmId === cat.id ? (
                  <div key={cat.id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-xs">
                    <span className="text-red-600 dark:text-red-400">Delete &ldquo;{cat.name}&rdquo;?</span>
                    <button onClick={() => handleDeleteCat(cat.id)} className="text-red-600 dark:text-red-400 font-semibold hover:underline ml-1">Yes</button>
                    <button onClick={() => setDeleteCatConfirmId(null)} className="text-zinc-500 dark:text-zinc-400 hover:underline ml-1">No</button>
                  </div>
                ) : (
                  <div key={cat.id} className="group flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-xs text-zinc-700 dark:text-zinc-200">
                    <span>{cat.name}</span>
                    <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-opacity ml-1"><IconPencil size={12} /></button>
                    <button onClick={() => setDeleteCatConfirmId(cat.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"><IconTrash size={12} /></button>
                  </div>
                )
              )}

              {isAddingCat && (
                <div className="flex items-center gap-1">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    maxLength={64}
                    placeholder="Category name"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateCat(); if (e.key === "Escape") { setIsAddingCat(false); setNewCatName(""); } }}
                    className="px-2 py-1 text-xs border border-primary rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary w-36"
                  />
                  <button onClick={handleCreateCat} disabled={isSavingCat} className="p-1 text-primary hover:text-primary/70 disabled:opacity-50"><IconCheck size={14} /></button>
                  <button onClick={() => { setIsAddingCat(false); setNewCatName(""); }} className="p-1 text-zinc-400 hover:text-zinc-600"><IconX size={14} /></button>
                </div>
              )}
            </div>
          </div>

          {/* ── Roles section ── */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <IconUserShield size={16} className="text-zinc-500 dark:text-zinc-400" />
              Roles
            </h4>

            {templates.length === 0 && !isAdding ? (
              <div className="py-8 flex flex-col items-center gap-2 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-500 dark:text-zinc-400">
                <IconUserShield size={32} className="opacity-40" />
                <p className="text-sm">No session roles defined yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([catKey, items]) => {
                  const catName = catKey === UNCATEGORISED ? null : categories.find((c) => c.id === catKey)?.name;
                  return (
                    <div key={catKey}>
                      {catName && (
                        <div className="flex items-center gap-2 mb-3">
                          <IconFolder size={14} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{catName}</span>
                          <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                        </div>
                      )}
                      <div className="space-y-3">
                        {items.map((template) =>
                          editingId === template.id ? (
                            <div key={template.id} className="p-4 rounded-lg border border-primary/40 bg-primary/5 dark:bg-primary/10 space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Role name</label>
                                  <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={64}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Category</label>
                                  <CategorySelect value={editCategoryId} onChange={setEditCategoryId} />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Slots</label>
                                  <input type="number" min={1} max={100} value={editSlots}
                                    onChange={(e) => setEditSlots(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Host type</label>
                                  <select value={editHostRole} onChange={(e) => setEditHostRole(e.target.value as "primary" | "secondary" | "")}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary">
                                    <option value="">— None —</option>
                                    <option value="primary">Primary Host</option>
                                    <option value="secondary">Secondary Host</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2">Eligible roles</label>
                                <GroupRolePicker selected={editGroupRoles} onToggle={(id) => toggleGroupRole(id, editGroupRoles, setEditGroupRoles)} />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={handleSaveEdit} disabled={isSavingEdit}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                                  <IconCheck size={14} /> Save
                                </button>
                                <button onClick={() => setEditingId(null)}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600">
                                  <IconX size={14} /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div key={template.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-zinc-900 dark:text-white">{template.name}</span>
                                  {template.hostRole === "primary" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                      <IconShield size={10} /> Primary Host
                                    </span>
                                  )}
                                  {template.hostRole === "secondary" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                      <IconShield size={10} /> Secondary Host
                                    </span>
                                  )}
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{template.slots} slot{template.slots !== 1 ? "s" : ""}</span>
                                </div>
                                {getRoleNames(template.groupRoles) && (
                                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Eligible: {getRoleNames(template.groupRoles)}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {deleteConfirmId === template.id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Delete?</span>
                                    <button onClick={() => handleDelete(template.id)} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Yes</button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600">No</button>
                                  </div>
                                ) : (
                                  <>
                                    <button onClick={() => startEdit(template)} className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors" title="Edit">
                                      <IconPencil size={16} />
                                    </button>
                                    <button onClick={() => setDeleteConfirmId(template.id)} className="p-1.5 text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors" title="Delete">
                                      <IconTrash size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add role form */}
            {isAdding ? (
              <div className="p-4 rounded-lg border border-primary/40 bg-primary/5 dark:bg-primary/10 space-y-4">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">New Session Role</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Role name</label>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={64} placeholder="e.g. Co-Host"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Category</label>
                    <CategorySelect value={newCategoryId} onChange={setNewCategoryId} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Slots</label>
                    <input type="number" min={1} max={100} value={newSlots}
                      onChange={(e) => setNewSlots(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">Host type</label>
                  <select value={newHostRole} onChange={(e) => setNewHostRole(e.target.value as "primary" | "secondary" | "")}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary">
                    <option value="">— None —</option>
                    <option value="primary">Primary Host</option>
                    <option value="secondary">Secondary Host</option>
                  </select>
                </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2">Eligible roles</label>
                  <GroupRolePicker selected={newGroupRoles} onToggle={(id) => toggleGroupRole(id, newGroupRoles, setNewGroupRoles)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    <IconCheck size={14} /> {isSaving ? "Saving…" : "Save role"}
                  </button>
                  <button onClick={() => { setIsAdding(false); setNewName(""); setNewCategoryId(""); setNewHostRole(""); setNewSlots(1); setNewGroupRoles([]); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600">
                    <IconX size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                <IconPlus size={16} /> Add session role
              </button>
            )}
          </div>
        </>
      )}

      {(archivedTemplates.length > 0 || archivedCategories.length > 0) && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-700/40 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <IconArchive size={15} />
              Archived ({archivedTemplates.length + archivedCategories.length})
            </span>
            <IconChevronDown size={15} className={`transition-transform ${showArchived ? "rotate-180" : ""}`} />
          </button>
          {showArchived && (
            <div className="p-4 space-y-4">
              {archivedCategories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">Categories</p>
                  <div className="space-y-2">
                    {archivedCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center gap-2">
                          <IconFolder size={14} className="text-zinc-400" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-300">{cat.name}</span>
                          <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">archived</span>
                        </div>
                        <button
                          onClick={() => handleRestoreCategory(cat.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-primary border border-primary/30 rounded hover:bg-primary/10 transition-colors"
                        >
                          <IconArrowBackUp size={13} /> Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {archivedTemplates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">Roles</p>
                  <div className="space-y-2">
                    {archivedTemplates.map((tpl) => (
                      <div key={tpl.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-zinc-600 dark:text-zinc-300">{tpl.name}</span>
                          {tpl.hostRole === "primary" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <IconShield size={9} /> Primary Host
                            </span>
                          )}
                          {tpl.hostRole === "secondary" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              <IconShield size={9} /> Secondary Host
                            </span>
                          )}
                          {tpl.category && (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">{tpl.category.name}</span>
                          )}
                          <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">archived</span>
                        </div>
                        <button
                          onClick={() => handleRestoreTemplate(tpl.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-primary border border-primary/30 rounded hover:bg-primary/10 transition-colors flex-shrink-0"
                        >
                          <IconArrowBackUp size={13} /> Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

SessionRoles.title = "Session Roles";

export default SessionRoles;
