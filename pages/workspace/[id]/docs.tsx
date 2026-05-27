import type { pageWithLayout } from "@/layoutTypes";
import { loginState } from "@/state";
import Workspace from "@/layouts/workspace";
import { useRecoilState } from "recoil";
import { useRouter } from "next/router";
import { useMemo } from "react";
import prisma, { document } from "@/utils/database";
import { GetServerSideProps } from "next";
import randomText from "@/utils/randomText";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import {
  IconFileText,
  IconPlus,
  IconClock,
  IconUser,
  IconArrowLeft,
  IconAlertTriangle,
  IconExternalLink,
  IconLink,
  IconFolderFilled,
  IconFolder,
  IconX,
  IconTrash,
  IconPencil,
  IconChevronDown,
  IconChevronUp,
  IconStar,
  IconStarFilled,
  IconChevronRight,
} from "@tabler/icons-react";
import clsx from "clsx";
import { Toaster, toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect } from "react";
import Tooltip from "@/components/tooltip";

const BG_COLORS = [
  "bg-amber-200",
  "bg-red-300",
  "bg-lime-200",
  "bg-emerald-300",
  "bg-rose-200",
  "bg-green-100",
  "bg-teal-200",
  "bg-yellow-200",
  "bg-red-100",
  "bg-green-300",
  "bg-lime-300",
  "bg-emerald-200",
  "bg-rose-300",
  "bg-amber-300",
  "bg-red-200",
  "bg-green-200",
];


function getRandomBg(userid: string, username?: string) {
  const key = `${userid ?? ""}:${username ?? ""}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) ^ key.charCodeAt(i);
  }
  const index = (hash >>> 0) % BG_COLORS.length;
  return BG_COLORS[index];
}

export const getServerSideProps = withPermissionCheckSsr(
  async (context: any) => {
    const { id } = context.query;
    const userid = context.req.session.userid;
    if (!userid) {
      return {
        redirect: {
          destination: "/login",
        },
      };
    }
    if (!id) {
      return {
        notFound: true,
      };
    }
    const user = await prisma.user.findFirst({
      where: {
        userid: userid,
      },
      include: {
        roles: {
          where: {
            workspaceGroupId: parseInt(id as string),
          },
        },
        workspaceMemberships: {
          where: {
            workspaceGroupId: parseInt(id as string),
          },
          include: {
            departmentMembers: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });
    if (!user) {
      return {
        redirect: {
          destination: "/login",
        },
      };
    }

    const membership = user.workspaceMemberships?.[0];
    const isAdmin = membership?.isAdmin || false;
    const userRoleIds = (user.roles || []).map((r: any) => r.id);
    const userDepartmentIds = (membership?.departmentMembers || []).map((dm: any) => dm.department.id);
    const canCreate = isAdmin || (user.roles || []).some(
      (r: any) => (r.permissions || []).includes("create_docs")
    );
    const canEdit = isAdmin || (user.roles || []).some(
      (r: any) => (r.permissions || []).includes("edit_docs")
    );
    const canDelete = isAdmin || (user.roles || []).some(
      (r: any) => (r.permissions || []).includes("delete_docs")
    );
    const canManage = canCreate || canEdit || canDelete;
    const canManageContainers = isAdmin || (user.roles || []).some(
      (r: any) => (r.permissions || []).includes("manage_containers")
    );
    const docWhere = canManage
      ? { workspaceGroupId: parseInt(id as string), requiresAcknowledgment: false }
      : {
          workspaceGroupId: parseInt(id as string),
          requiresAcknowledgment: false,
          OR: [
            { roles: { some: { id: { in: userRoleIds } } } },
            ...(userDepartmentIds.length > 0
              ? [{ departments: { some: { id: { in: userDepartmentIds } } } }]
              : []),
          ],
        };
    const containerWhere = canManage
      ? { workspaceGroupId: parseInt(id as string) }
      : {
          workspaceGroupId: parseInt(id as string),
          OR: [
            { roles: { some: { id: { in: userRoleIds } } } },
            ...(userDepartmentIds.length > 0
              ? [{ departments: { some: { id: { in: userDepartmentIds } } } }]
              : []),
          ],
        };
    const [docs, containers, allRoles, allDepartments] = await Promise.all([
      prisma.document.findMany({
        where: docWhere,
        include: {
          owner: { select: { userid: true, username: true, picture: true } },
        },
      }),
      prisma.documentContainer.findMany({
        where: containerWhere,
        include: {
          owner: { select: { userid: true, username: true } },
          roles: { select: { id: true, name: true } },
          departments: { select: { id: true, name: true } },
          documents: { select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      canManageContainers
        ? prisma.role.findMany({
            where: { workspaceGroupId: parseInt(id as string) },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      canManageContainers
        ? prisma.department.findMany({
            where: { workspaceGroupId: parseInt(id as string) },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const serial = (v: any) =>
      JSON.parse(JSON.stringify(v, (_, val) => (typeof val === "bigint" ? val.toString() : val)));

    return {
      props: {
        documents: serial(docs),
        containers: serial(containers),
        allRoles: serial(allRoles),
        allDepartments: serial(allDepartments),
        canCreate,
        canEdit,
        canDelete,
        canManageContainers,
      },
    };
  }
);

type DocOwner = { userid: string; username: string; picture: string };
type DocItem = document & { owner: DocOwner };
type Container = {
  id: string;
  name: string;
  description?: string | null;
  documents: { id: string }[];
  roles: { id: string; name: string }[];
  departments: { id: string; name: string }[];
};

type pageProps = {
  documents: DocItem[];
  containers: Container[];
  allRoles: { id: string; name: string }[];
  allDepartments: { id: string; name: string }[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageContainers: boolean;
};

const Home: pageWithLayout<pageProps> = ({
  documents,
  containers: initialContainers,
  allRoles,
  allDepartments,
  canCreate,
  canEdit,
  canDelete,
  canManageContainers,
}) => {
  const [login] = useRecoilState(loginState);
  const text = useMemo(() => randomText(login.displayname), [login.displayname]);
  const router = useRouter();
  const canManageDocs = canCreate || canEdit || canDelete;
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [containers, setContainers] = useState<Container[]>(initialContainers);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  useEffect(() => {
    const folder = router.query.folder as string | undefined;
    if (folder) setSelectedContainerId(folder);
  }, [router.query.folder]);

  const selectContainer = useCallback((id: string | null) => {
    setSelectedContainerId(id);
    const { folder: _f, ...rest } = router.query;
    if (id) {
      router.replace({ query: { ...rest, folder: id } }, undefined, { shallow: true });
    } else {
      router.replace({ query: rest }, undefined, { shallow: true });
    }
  }, [router]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContainerName, setNewContainerName] = useState("");
  const [newContainerDesc, setNewContainerDesc] = useState("");
  const [newContainerRoles, setNewContainerRoles] = useState<string[]>([]);
  const [newContainerDepts, setNewContainerDepts] = useState<string[]>([]);
  const [creatingContainer, setCreatingContainer] = useState(false);
  const [deleteConfirmContainer, setDeleteConfirmContainer] = useState<Container | null>(null);
  const [deletingContainer, setDeletingContainer] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editDepts, setEditDepts] = useState<string[]>([]);
  const [editDocs, setEditDocs] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [moveDocPopover, setMoveDocPopover] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<string | null>(null);
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [dragOverContainerId, setDragOverContainerId] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const handleExternalLink = (url: string) => {
    setPendingUrl(url);
    setShowExternalLinkModal(true);
  };
  const proceedWithLink = () => {
    if (pendingUrl) window.open(pendingUrl, "_blank");
    setShowExternalLinkModal(false);
    setPendingUrl(null);
  };
  const cancelLink = () => {
    setShowExternalLinkModal(false);
    setPendingUrl(null);
  };
  const goToGuide = (doc: any) => {
    if (doc?.content?.external) {
      try {
        handleExternalLink(doc.content.url);
        return;
      } catch {}
    }
    router.push(`/workspace/${router.query.id}/docs/${doc.id}`);
  };
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`docs_starred_${router.query.id}`);
      if (stored) setStarredIds(new Set(JSON.parse(stored)));
    } catch {}
  }, [router.query.id]);
  const toggleStar = useCallback((docId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      try {
        localStorage.setItem(`docs_starred_${router.query.id}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, [router.query.id]);
  const containerDocIds = useMemo(() => {
    const ids = new Set<string>();
    containers.forEach((c) => c.documents.forEach((d) => ids.add(d.id)));
    return ids;
  }, [containers]);
  const currentDocs = useMemo(() => {
    if (selectedContainerId) {
      const container = containers.find((c) => c.id === selectedContainerId);
      if (!container) return [];
      const ids = new Set(container.documents.map((d) => d.id));
      return documents.filter((d) => ids.has(d.id));
    }
    return documents.filter((d) => !containerDocIds.has(d.id));
  }, [selectedContainerId, containers, documents, containerDocIds]);
  const pinnedDocs = useMemo(
    () => documents.filter((d) => starredIds.has(d.id)),
    [documents, starredIds]
  );
  const handleCreateContainer = async () => {
    if (!newContainerName.trim()) return toast.error("Name is required");
    if (newContainerRoles.length === 0 && newContainerDepts.length === 0)
      return toast.error("At least one role or department must be selected");
    setCreatingContainer(true);
    try {
      const res = await fetch(`/api/workspace/${router.query.id}/guides/containers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContainerName.trim(),
          description: newContainerDesc.trim() || null,
          roles: newContainerRoles,
          departments: newContainerDepts,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setContainers((prev) => [...prev, data.container]);
      setShowCreateModal(false);
      setNewContainerName("");
      setNewContainerDesc("");
      setNewContainerRoles([]);
      setNewContainerDepts([]);
      toast.success("Container created!");
    } catch (e: any) {
      toast.error(e.message || "Failed to create container.");
    } finally {
      setCreatingContainer(false);
    }
  };
  const openEdit = (container: Container) => {
    setEditingContainer(container);
    setEditName(container.name);
    setEditDesc(container.description || "");
    setEditRoles(container.roles.map((r) => r.id));
    setEditDepts(container.departments.map((d) => d.id));
    setEditDocs(container.documents.map((d) => d.id));
  };
  const handleSaveEdit = async () => {
    if (!editingContainer) return;
    if (!editName.trim()) return toast.error("Name is required");
    if (editRoles.length === 0 && editDepts.length === 0)
      return toast.error("At least one role or department must be selected");
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/workspace/${router.query.id}/guides/containers/${editingContainer.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDesc.trim() || null,
            roles: editRoles,
            departments: editDepts,
            documents: editDocs,
          }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setContainers((prev) =>
        prev.map((c) => (c.id === editingContainer.id ? data.container : c))
      );
      setEditingContainer(null);
      toast.success("Container updated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update container.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteContainer = (container: Container) => {
    setDeleteConfirmContainer(container);
  };

  const confirmDeleteContainer = async () => {
    if (!deleteConfirmContainer) return;
    setDeletingContainer(true);
    try {
      const res = await fetch(
        `/api/workspace/${router.query.id}/guides/containers/${deleteConfirmContainer.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setContainers((prev) => prev.filter((c) => c.id !== deleteConfirmContainer.id));
      if (selectedContainerId === deleteConfirmContainer.id) selectContainer(null);
      toast.success("Container deleted!");
      setDeleteConfirmContainer(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete container.");
    } finally {
      setDeletingContainer(false);
    }
  };

  const handleToggleDocInContainer = async (docId: string, containerId: string) => {
    const container = containers.find((c) => c.id === containerId);
    if (!container) return;
    const isInContainer = container.documents.some((d) => d.id === docId);
    setMovingDoc(docId);
    try {
      const res = await fetch(
        `/api/workspace/${router.query.id}/guides/containers/${containerId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toggleDocument: { id: docId, action: isInContainer ? "remove" : "add" } }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setContainers((prev) =>
        prev.map((c) => {
          if (c.id !== containerId) return c;
          const docs = isInContainer
            ? c.documents.filter((d) => d.id !== docId)
            : [...c.documents, { id: docId }];
          return { ...c, documents: docs };
        })
      );
      toast.success(isInContainer ? "Removed from container!" : "Added to container!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update container.");
    } finally {
      setMovingDoc(null);
    }
  };

  const toggleMulti = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Toaster position="bottom-center" />
      <div className="2xl:pr-12 lg:pr-10 md:pr-8 sm:pr-6 pr-4 md:pl-6 pl-4 py-2">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-white">Documents</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-300">
              Create and manage your workspace documentation
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop buttons */}
            {canManageContainers && !selectedContainerId && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
              >
                <IconFolder className="w-4 h-4" />
                <span className="text-sm font-medium">New Container</span>
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => router.push(`/workspace/${router.query.id}/docs/new${selectedContainerId ? `?containerId=${selectedContainerId}` : ``}`)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                <IconPlus className="w-4 h-4" />
                <span className="text-sm font-medium">New Document</span>
              </button>
            )}
            {(canCreate || (canManageContainers && !selectedContainerId)) && (
              <div className="relative sm:hidden">
                <button
                  onClick={() => setShowCreateDropdown((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
                >
                  <IconPlus className="w-4 h-4" />
                  <span className="text-sm font-medium">Create</span>
                  <IconChevronDown className="w-3.5 h-3.5" />
                </button>
                {showCreateDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCreateDropdown(false)} />
                    <div className="absolute right-0 mt-1 w-48 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg z-20 overflow-hidden">
                      {canCreate && (
                        <button
                          onClick={() => { setShowCreateDropdown(false); router.push(`/workspace/${router.query.id}/docs/new${selectedContainerId ? `?containerId=${selectedContainerId}` : ``}`); }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <IconFileText className="w-4 h-4 text-zinc-500" />
                          New Document
                        </button>
                      )}
                      {canManageContainers && !selectedContainerId && (
                        <button
                          onClick={() => { setShowCreateDropdown(false); setShowCreateModal(true); }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <IconFolder className="w-4 h-4 text-zinc-500" />
                          New Container
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedContainerId ? (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => selectContainer(null)}
              onDragOver={(e) => { if (!draggingDocId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverContainerId("__back__"); }}
              onDragLeave={() => setDragOverContainerId(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingDocId && selectedContainerId) {
                  const inContainer = containers.find((c) => c.id === selectedContainerId)?.documents.some((d) => d.id === draggingDocId);
                  if (inContainer) handleToggleDocInContainer(draggingDocId, selectedContainerId);
                }
                setDraggingDocId(null);
                setDragOverContainerId(null);
              }}
              className={`flex items-center gap-1.5 text-sm transition-all ${
                dragOverContainerId === "__back__"
                  ? "text-red-500 dark:text-red-400 scale-105"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <IconArrowLeft className="w-4 h-4" />
              Documents
            </button>
            <IconChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
            <span className="text-sm font-medium text-zinc-900 dark:text-white">
              {containers.find((c) => c.id === selectedContainerId)?.name}
            </span>
            {containers.find((c) => c.id === selectedContainerId)?.description && (
              <span className="hidden sm:inline text-sm text-zinc-400 dark:text-zinc-500 truncate">
                - {containers.find((c) => c.id === selectedContainerId)?.description}
              </span>
            )}
            {canManageContainers && (
              <div className="ml-auto flex gap-1">
                <Tooltip orientation="top" tooltipText="Edit folder">
                  <button
                    onClick={() => { const c = containers.find((x) => x.id === selectedContainerId); if (c) openEdit(c); }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <IconPencil className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip orientation="top" tooltipText="Delete folder">
                  <button
                    onClick={() => { const c = containers.find((x) => x.id === selectedContainerId); if (c) handleDeleteContainer(c); }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <IconTrash className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        ) : null}

        {moveDocPopover && (
          <div className="fixed inset-0 z-10" onClick={() => setMoveDocPopover(null)} />
        )}

        {!selectedContainerId && pinnedDocs.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <IconStarFilled className="w-3.5 h-3.5 text-amber-400" />
              Starred Documents
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-0.5 md:gap-0">
              {pinnedDocs.map((doc) => (
                <div
                  key={`pinned-${doc.id}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingDocId(doc.id); }}
                  onDragEnd={() => setDraggingDocId(null)}
                  onClick={() => goToGuide(doc)}
                  className={`group relative flex flex-col items-center gap-1 px-2 pt-2 pb-1.5 rounded-xl cursor-pointer select-none transition-all hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 ${draggingDocId === doc.id ? "opacity-40 scale-95" : ""}`}
                >
                  {canManageDocs && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(doc.id); }}
                      className="absolute top-1 left-1 z-10 p-0.5 rounded text-amber-400"
                      title="Unpin"
                    >
                      <IconStarFilled className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-xl md:rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    {(doc.content as any)?.external ? (
                      <IconLink className="w-5 h-5 md:w-7 md:h-7 text-primary" />
                    ) : (
                      <IconFileText className="w-5 h-5 md:w-7 md:h-7 text-primary" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-center text-zinc-800 dark:text-zinc-200 leading-tight line-clamp-2 w-full break-words">{doc.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedContainerId && containers.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Containers</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-0.5 md:gap-0">
              {containers.map((container) => (
                <div
                  key={container.id}
                  onClick={() => selectContainer(container.id)}
                  onDragOver={(e) => { if (!draggingDocId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverContainerId(container.id); }}
                  onDragLeave={() => setDragOverContainerId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingDocId && !container.documents.some((d) => d.id === draggingDocId)) {
                      handleToggleDocInContainer(draggingDocId, container.id);
                    }
                    setDraggingDocId(null);
                    setDragOverContainerId(null);
                  }}
                  className={`group relative flex flex-col items-center gap-1 px-2 pt-2 pb-1.5 rounded-xl cursor-pointer select-none transition-all ${
                    dragOverContainerId === container.id
                      ? "bg-amber-50/80 dark:bg-amber-900/20 ring-2 ring-amber-400 dark:ring-amber-500"
                      : "hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50"
                  }`}
                >
                  {canManageContainers && (
                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5 z-10">
                      <Tooltip orientation="bottom" tooltipText="Edit">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(container); }}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <IconPencil className="w-3 h-3" />
                        </button>
                      </Tooltip>
                      <Tooltip orientation="bottom" tooltipText="Delete">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteContainer(container); }}
                          className="p-1 rounded text-zinc-500 hover:text-red-500 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <IconTrash className="w-3 h-3" />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                  <div className="relative">
                    <IconFolderFilled className="w-11 h-11 md:w-16 md:h-16 text-amber-400 drop-shadow-sm" />
                    {container.documents.length > 0 && (
                      <span className="absolute -bottom-0.5 -right-1 bg-zinc-600 dark:bg-zinc-400 text-white dark:text-zinc-900 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                        {container.documents.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-center text-zinc-800 dark:text-zinc-200 leading-tight line-clamp-2 w-full break-words">{container.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentDocs.length > 0 ? (
          <div>
            {!selectedContainerId && (
              <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Documents</h2>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-0.5 md:gap-0">
              {currentDocs.map((doc) => (
                <div
                  key={doc.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingDocId(doc.id); }}
                  onDragEnd={() => setDraggingDocId(null)}
                  onClick={() => goToGuide(doc)}
                  className={`group relative flex flex-col items-center gap-1 px-2 pt-2 pb-1.5 rounded-xl cursor-pointer select-none transition-all hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 ${draggingDocId === doc.id ? "opacity-40 scale-95" : ""}`}
                >
                  {canManageDocs && (
                    <div className={`absolute top-1 left-1 z-10 ${starredIds.has(doc.id) ? "" : "opacity-0 group-hover:opacity-100"}`}>
                      <Tooltip orientation="bottom" tooltipText={starredIds.has(doc.id) ? "Unpin" : "Pin"}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStar(doc.id); }}
                          className={`p-0.5 rounded transition-all ${
                            starredIds.has(doc.id)
                              ? "text-amber-400"
                              : "text-zinc-400 hover:text-amber-400"
                          }`}
                        >
                          {starredIds.has(doc.id) ? (
                            <IconStarFilled className="w-3.5 h-3.5" />
                          ) : (
                            <IconStar className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  )}
                  <div className={`absolute top-1 right-1 gap-0.5 z-10 ${moveDocPopover === doc.id ? "flex" : "hidden group-hover:flex"}`}>
                    {canEdit && containers.length > 0 && (
                      <div className="relative">
                        <Tooltip orientation="bottom" tooltipText="Move to folder">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMoveDocPopover(moveDocPopover === doc.id ? null : doc.id); }}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          >
                            <IconFolder className="w-3 h-3" />
                          </button>
                        </Tooltip>
                        {moveDocPopover === doc.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-20 py-1">
                            <p className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Move to folder</p>
                            {containers.map((container) => {
                              const inContainer = container.documents.some((d) => d.id === doc.id);
                              return (
                                <button
                                  key={container.id}
                                  onClick={(e) => { e.stopPropagation(); handleToggleDocInContainer(doc.id, container.id); }}
                                  disabled={movingDoc === doc.id}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                >
                                  <IconFolderFilled className={`w-3.5 h-3.5 flex-shrink-0 ${inContainer ? "text-primary" : "text-zinc-400"}`} />
                                  <span className="flex-1 text-left truncate">{container.name}</span>
                                  {inContainer && <span className="text-primary text-[10px] font-medium">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {(canEdit || canDelete) && (
                      <Tooltip orientation="bottom" tooltipText="Edit">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/workspace/${router.query.id}/docs/${doc.id}/edit`); }}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <IconPencil className="w-3 h-3" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  <div className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-xl md:rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    {(doc.content as any)?.external ? (
                      <IconLink className="w-5 h-5 md:w-7 md:h-7 text-primary" />
                    ) : (
                      <IconFileText className="w-5 h-5 md:w-7 md:h-7 text-primary" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-center text-zinc-800 dark:text-zinc-200 leading-tight line-clamp-2 w-full break-words">{doc.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              {selectedContainerId ? (
                <IconFolderFilled className="w-8 h-8 text-primary" />
              ) : (
                <IconFileText className="w-8 h-8 text-primary" />
              )}
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
              {selectedContainerId ? "This folder is empty" : "No documents yet"}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-300 mb-4">
              {selectedContainerId
                ? "Use the move button on any document to add it here."
                : canCreate
                ? "Create your first document to get started."
                : "Your workspace admin has not created any documents yet."}
            </p>
          </div>
        )}
      </div>

      {deleteConfirmContainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Confirm Deletion
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete{" "}
              <strong>{deleteConfirmContainer.name}</strong>?
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              The documents inside will not be deleted.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setDeleteConfirmContainer(null)}
                disabled={deletingContainer}
                className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteContainer}
                disabled={deletingContainer}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deletingContainer ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExternalLinkModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="external-link-title"
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden"
          >
            <div className="px-6 py-5 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md">
                    <IconAlertTriangle size={24} />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 id="external-link-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    External Link Warning
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    This is a link submitted by a member in this workspace. Links are not verified by Firefli so please proceed at your own risk.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button type="button" onClick={proceedWithLink} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-white font-medium shadow-md transition-all">
                  <IconExternalLink size={18} />
                  Continue
                </button>
                <button type="button" onClick={cancelLink} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100/90">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <IconFolderFilled className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">New Container</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newContainerName}
                  onChange={(e) => setNewContainerName(e.target.value)}
                  placeholder="e.g. Support Team"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <input
                  type="text"
                  value={newContainerDesc}
                  onChange={(e) => setNewContainerDesc(e.target.value)}
                  placeholder="Brief description of this container"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Visible to roles</label>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">At least one role or department must be selected.</p>
                  {allRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allRoles.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => toggleMulti(r.id, newContainerRoles, setNewContainerRoles)}
                          className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            newContainerRoles.includes(r.id)
                              ? "bg-primary text-white border-primary"
                              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                          )}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No roles configured in this workspace.</p>
                  )}
                </div>
              {allDepartments.length > 0 && (
              <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Visible to departments</label>
                  <div className="flex flex-wrap gap-2">
                      {allDepartments.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => toggleMulti(d.id, newContainerDepts, setNewContainerDepts)}
                          className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            newContainerDepts.includes(d.id)
                              ? "bg-primary text-white border-primary"
                              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                          )}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                Cancel
              </button>
              <button
                onClick={handleCreateContainer}
                disabled={creatingContainer}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {creatingContainer ? "Creating..." : "Create Container"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {editingContainer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <IconFolderFilled className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Edit Container</h2>
              </div>
              <button onClick={() => setEditingContainer(null)} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Visible to roles</label>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">At least one role or department must be selected.</p>
                  {allRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allRoles.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => toggleMulti(r.id, editRoles, setEditRoles)}
                          className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            editRoles.includes(r.id)
                              ? "bg-primary text-white border-primary"
                              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                          )}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No roles configured in this workspace.</p>
                  )}
                </div>
              {allDepartments.length > 0 && (
              <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Visible to departments</label>
                  <div className="flex flex-wrap gap-2">
                      {allDepartments.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => toggleMulti(d.id, editDepts, setEditDepts)}
                          className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            editDepts.includes(d.id)
                              ? "bg-primary text-white border-primary"
                              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                          )}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
              <button onClick={() => setEditingContainer(null)} className="px-4 py-2 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

Home.layout = Workspace;

export default Home;
