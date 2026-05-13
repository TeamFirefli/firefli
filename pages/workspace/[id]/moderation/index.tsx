import workspace from "@/layouts/workspace";
import { pageWithLayout } from "@/layoutTypes";
import axios from "axios";
import { useRouter } from "next/router";
import { useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import prisma from "@/utils/database";
import { getConfig } from "@/utils/configEngine";
import moment from "moment";
import Tooltip from "@/components/tooltip";
import { useRecoilValue } from "recoil";
import { workspacestate } from "@/state";
import {
  IconFile,
  IconAlertTriangle,
  IconBan,
  IconCheck,
  IconX,
  IconPlus,
  IconFileText,
  IconUpload,
  IconSearch,
  IconFilter,
  IconEye,
  IconLoader2,
} from "@tabler/icons-react";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  resolved: "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300",
  archived: "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400",
  appealed:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  revoked:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
};

interface ModerationCaseListItem {
  id: string;
  targetUserId: string;
  targetUsername?: string;
  reason: string;
  status: string;
  action?: string;
  createdAt: string;
  banDuration?: number;
  isPermanent?: boolean;
  revokedAt?: string;
  targetUser?: {
    userid: string;
    username?: string;
    picture?: string;
  };
  creator?: {
    userid: string;
    username?: string;
    picture?: string;
  };
  evidence?: Array<{ id: string }>;
}

interface ModerationStats {
  total: number;
  open: number;
  resolved: number;
  activeBans: number;
}

interface ModerationDashboardProps {
  cases: ModerationCaseListItem[];
  stats: ModerationStats;
  initialTotal: number;
  initialPages: number;
}

export const getServerSideProps = withPermissionCheckSsr(
  async ({ params, req }) => {
    const userId = req.session?.userid;
    const groupId = BigInt(params?.id as string);

    const moderationConfig = await getConfig('moderation', groupId);
    if (!moderationConfig?.enabled) {
      return { notFound: true };
    }

    if (!userId) {
      return {
        props: {
          cases: [],
          stats: { total: 0, open: 0, resolved: 0, activeBans: 0 },
          initialTotal: 0,
          initialPages: 0,
        },
      };
    }

    try {
      // Fetch recent cases
      const cases = await prisma.moderationCase.findMany({
        where: {
          workspaceGroupId: groupId,
        },
        include: {
          targetUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
          createdByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
          evidence: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        skip: 0,
      });

      // Get stats
      const [total, open, resolved, activeBans] = await Promise.all([
        prisma.moderationCase.count({ where: { workspaceGroupId: groupId } }),
        prisma.moderationCase.count({
          where: { workspaceGroupId: groupId, status: "open" },
        }),
        prisma.moderationCase.count({
          where: { workspaceGroupId: groupId, status: "resolved" },
        }),
        prisma.playerBan.count({
          where: { workspaceGroupId: groupId, active: true },
        }),
      ]);

      return {
        props: {
          cases: JSON.parse(
            JSON.stringify(cases, (_, value) =>
              typeof value === "bigint" ? value.toString() : value,
            ),
          ),
          stats: { total, open, resolved, activeBans },
          initialTotal: total,
          initialPages: Math.ceil(total / 20),
        },
      };
    } catch (error) {
      console.error("Error fetching moderation data:", error);
      return {
        props: {
          cases: [],
          stats: { total: 0, open: 0, resolved: 0, activeBans: 0 },
          initialTotal: 0,
          initialPages: 0,
        },
      };
    }
  },
  ["view_moderation"],
);

const ModerationDashboard: pageWithLayout<ModerationDashboardProps> = ({
  cases: initialCases,
  stats,
  initialTotal,
  initialPages,
}) => {
  const router = useRouter();
  const { id: workspaceId } = router.query;
  const workspaceData = useRecoilValue(workspacestate);
  const [cases, setCases] = useState(initialCases);
  const [selectedCase, setSelectedCase] =
    useState<ModerationCaseListItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [caseToRevoke, setCaseToRevoke] =
    useState<ModerationCaseListItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialPages);
  const [totalCases, setTotalCases] = useState(initialTotal);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canCreateCases =
    workspaceData.yourPermission?.includes("create_moderation_cases") ||
    workspaceData.isAdmin;
  const canExecutePunishments =
    workspaceData.yourPermission?.includes("execute_punishments") ||
    workspaceData.isAdmin;
  const canRevokePunishments =
    workspaceData.yourPermission?.includes("revoke_punishments") ||
    workspaceData.isAdmin;

  const refreshCases = async (page: number, search: string, status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      const response = await axios.get(
        `/api/workspace/${workspaceId}/moderation/cases?${params}`,
      );
      if (response.data.success) {
        setCases(response.data.data.cases);
        setCurrentPage(response.data.data.pagination.page);
        setTotalPages(response.data.data.pagination.pages);
        setTotalCases(response.data.data.pagination.total);
      }
    } catch (error) {
      toast.error("Failed to refresh cases");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      refreshCases(1, value, filterStatus);
    }, 400);
  };

  const handleStatusChange = (value: string) => {
    setFilterStatus(value);
    refreshCases(1, searchQuery, value);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || loading) return;
    refreshCases(page, searchQuery, filterStatus);
  };

  const handleCreateCase = async (formData: any) => {
    try {
      const response = await axios.post(
        `/api/workspace/${workspaceId}/moderation/cases`,
        formData,
      );
      if (response.data.success) {
        toast.success("Case created successfully");
        setShowCreateModal(false);
        refreshCases(1, searchQuery, filterStatus);
      }
    } catch (error) {
      toast.error("Failed to create case");
    }
  };

  const handleExecuteBan = async (caseData: ModerationCaseListItem) => {
    try {
      const response = await axios.post(
        `/api/workspace/${workspaceId}/moderation/bans`,
        {
          userId: caseData.targetUserId,
          username: caseData.targetUsername,
          reason: caseData.reason,
          duration: caseData.banDuration,
          isPermanent: caseData.isPermanent,
          caseId: caseData.id,
        },
      );
      if (response.data.success) {
        toast.success(response.data.data.message);
        refreshCases(currentPage, searchQuery, filterStatus);
      }
    } catch (error) {
      toast.error("Failed to execute ban");
    }
  };

  const handleOpenRevokeModal = (caseData: ModerationCaseListItem) => {
    setCaseToRevoke(caseData);
    setShowRevokeModal(true);
  };

  const handleRevoke = async () => {
    if (!caseToRevoke) return;

    if (!revokeReason.trim()) {
      toast.error("Please provide a reason for revocation");
      return;
    }

    setRevoking(true);
    try {
      const response = await axios.post(
        `/api/workspace/${workspaceId}/moderation/cases/${caseToRevoke.id}/revoke`,
        { reason: revokeReason },
      );

      if (response.data.success) {
        toast.success("Case action revoked successfully");
        setShowRevokeModal(false);
        setRevokeReason("");
        setCaseToRevoke(null);
        refreshCases(currentPage, searchQuery, filterStatus);
      }
    } catch (error) {
      toast.error("Failed to revoke case action");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Toaster position="bottom-center" />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Moderation Dashboard
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Manage cases, bans, and moderation actions
            </p>
          </div>
          {canCreateCases && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
            >
              <IconPlus size={18} />
              <span className="hidden sm:inline">New Case</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 border border-white/10 rounded-xl p-4 shadow-sm mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <IconSearch
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search by username or reason..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors text-sm"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="revoked">Revoked</option>
          </select>
          <button
            onClick={() => refreshCases(currentPage, searchQuery, filterStatus)}
            disabled={loading}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600 text-zinc-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 border border-white/10 rounded-xl shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-700/50 border-b border-zinc-200 dark:border-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Target User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Punishment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Evidence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <IconFile className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
                        No cases found
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        No moderation cases match your criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() =>
                      router.push(
                        `/workspace/${workspaceId}/moderation/cases/${c.id}`,
                      )
                    }
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            c.targetUser?.picture ||
                            `/api/workspace/${workspaceId}/avatar/${c.targetUserId}`
                          }
                          alt=""
                          className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-zinc-700"
                        />
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white text-sm">
                            {c.targetUsername ||
                              c.targetUser?.username ||
                              "Unknown"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            ID: {c.targetUserId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate text-sm text-zinc-900 dark:text-white">
                        {c.reason}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          c.revokedAt
                            ? STATUS_COLORS["revoked"]
                            : STATUS_COLORS[c.status] ||
                              "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                        }`}
                      >
                        {c.revokedAt
                          ? "Revoked"
                          : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.action ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            c.action === "kick"
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                              : c.action === "warning"
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                          }`}
                        >
                          {c.action === "kick"
                            ? "Kick"
                            : c.action === "warning"
                            ? "Warning"
                            : c.action === "temp_ban"
                            ? "Temp Ban"
                            : c.action === "perm_ban"
                            ? "Perm Ban"
                            : c.action.charAt(0).toUpperCase() + c.action.slice(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {c.evidence?.length || 0} files
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {moment(c.createdAt).fromNow()}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {c.action && !c.revokedAt && canRevokePunishments && (
                          <Tooltip
                            orientation="top"
                            tooltipText="Revoke Action"
                          >
                            <button
                              onClick={() => handleOpenRevokeModal(c)}
                              className="text-orange-500 hover:text-orange-600 transition-colors"
                            >
                              <IconX size={18} />
                            </button>
                          </Tooltip>
                        )}
                        {c.status === "open" &&
                          isBanAction(c.action) &&
                          canExecutePunishments && (
                            <Tooltip
                              orientation="top"
                              tooltipText="Execute Ban"
                            >
                              <button
                                onClick={() => handleExecuteBan(c)}
                                className="text-red-500 hover:text-red-600 transition-colors"
                              >
                                <IconBan size={18} />
                              </button>
                            </Tooltip>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-700">
          {cases.length === 0 ? (
            <div className="px-4 py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <IconFile className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
                  No cases found
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No moderation cases match your criteria.
                </p>
              </div>
            </div>
          ) : (
            cases.map((c) => (
              <div
                key={c.id}
                onClick={() =>
                  router.push(
                    `/workspace/${workspaceId}/moderation/cases/${c.id}`,
                  )
                }
                className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={
                      c.targetUser?.picture ||
                      `/api/workspace/${workspaceId}/avatar/${c.targetUserId}`
                    }
                    alt=""
                    className="w-12 h-12 rounded-full ring-2 ring-white dark:ring-zinc-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-white">
                      {c.targetUsername ||
                        c.targetUser?.username ||
                        "Unknown"}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      ID: {c.targetUserId}
                    </div>
                    <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
                      {c.reason}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.revokedAt
                        ? STATUS_COLORS["revoked"]
                        : STATUS_COLORS[c.status] ||
                          "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    }`}
                  >
                    {c.revokedAt
                      ? "Revoked"
                      : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                  {c.action && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.action === "kick"
                          ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                          : c.action === "warning"
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                      }`}
                    >
                      {c.action === "kick"
                        ? "Kick"
                        : c.action === "warning"
                        ? "Warning"
                        : c.action === "temp_ban"
                        ? "Temp Ban"
                        : c.action === "perm_ban"
                        ? "Perm Ban"
                        : c.action.charAt(0).toUpperCase() + c.action.slice(1)}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.evidence?.length || 0} files • {moment(c.createdAt).fromNow()}
                  </span>
                </div>

                {(c.action && !c.revokedAt && canRevokePunishments) ||
                (c.status === "open" &&
                  isBanAction(c.action) &&
                  canExecutePunishments) ? (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {c.action && !c.revokedAt && canRevokePunishments && (
                      <button
                        onClick={() => handleOpenRevokeModal(c)}
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                      >
                        <IconX size={16} />
                        Revoke
                      </button>
                    )}
                    {c.status === "open" &&
                      isBanAction(c.action) &&
                      canExecutePunishments && (
                        <button
                          onClick={() => handleExecuteBan(c)}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                        >
                          <IconBan size={16} />
                          Execute Ban
                        </button>
                      )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 order-2 sm:order-1">
          {totalCases === 0
            ? "No cases found"
            : `Showing ${Math.min((currentPage - 1) * 20 + 1, totalCases)}-${Math.min(currentPage * 20, totalCases)} of ${totalCases} cases`}
        </p>
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          {getPageNumbers(currentPage, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-zinc-400">…</span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p as number)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  p === currentPage
                    ? "bg-primary text-white"
                    : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl border border-white/10">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
              Create New Case
            </h2>
            <CreateCaseForm
              onSubmit={handleCreateCase}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      {showRevokeModal && caseToRevoke && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-white/10">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
              Revoke Action
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              This will revoke the {caseToRevoke.action?.replace(/_/g, " ")}{" "}
              action for case{" "}
              <span className="font-medium">{caseToRevoke.targetUsername}</span>
              . Please provide a reason for the revocation.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Revocation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
                  rows={4}
                  placeholder="Explain why this action is being revoked..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRevoke}
                disabled={revoking || !revokeReason.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {revoking ? "Revoking..." : "Revoke Action"}
              </button>
              <button
                onClick={() => {
                  setShowRevokeModal(false);
                  setRevokeReason("");
                  setCaseToRevoke(null);
                }}
                disabled={revoking}
                className="px-6 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white py-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

const isBanAction = (action?: string) =>
  action === "temp_ban" || action === "perm_ban";

const getActionLabel = (action?: string) => {
  switch (action) {
    case "warning":
      return "Warning";
    case "kick":
      return "Kick";
    case "temp_ban":
      return "Temporary Ban";
    case "perm_ban":
      return "Permanent Ban";
    default:
      return "None";
  }
};

const CreateCaseForm = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) => {
  const [usernameSearch, setUsernameSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [userFound, setUserFound] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    reason: "",
    description: "",
    action: "",
    expiresAt: "",
  });

  const handleSearchUser = async () => {
    if (!usernameSearch.trim()) {
      toast.error("Please enter a username");
      return;
    }

    setSearching(true);
    try {
      const response = await axios.post("/api/roblox/id", {
        keyword: usernameSearch.trim(),
      });

      if (response.data?.data?.length > 0) {
        const user = response.data.data[0];
        setUserFound({
          userId: user.id.toString(),
          username: user.name,
        });
        toast.success(`User found: ${user.name}`);
      } else {
        setUserFound(null);
        toast.error("Roblox user not found");
      }
    } catch (error) {
      setUserFound(null);
      toast.error("Failed to search for user");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFound) {
      toast.error("Please search and select a user first");
      return;
    }
    if (formData.action === "temp_ban" && !formData.expiresAt) {
      toast.error("Please select an expiry date for temporary ban");
      return;
    }
    onSubmit({
      targetUserId: userFound.userId,
      targetUsername: userFound.username,
      ...formData,
      expiresAt: formData.expiresAt
        ? new Date(formData.expiresAt).toISOString()
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Target Username <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={usernameSearch}
              onChange={(e) => {
                setUsernameSearch(e.target.value);
                setUserFound(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchUser();
                }
              }}
              className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              placeholder="Enter Roblox username..."
              disabled={searching}
            />
            <button
              type="button"
              onClick={handleSearchUser}
              disabled={searching || !usernameSearch.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {searching ? (
                <>
                  <IconLoader2 size={16} className="animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <IconSearch size={16} />
                  Search
                </>
              )}
            </button>
          </div>
          {userFound && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <IconCheck size={16} />
              <span>
                User found: {userFound.username} (ID: {userFound.userId})
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Reason
          </label>
          <input
            type="text"
            required
            value={formData.reason}
            onChange={(e) =>
              setFormData({ ...formData, reason: e.target.value })
            }
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            placeholder="Brief reason for case"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
            rows={3}
            placeholder="Detailed description"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Planned Action
          </label>
          <select
            value={formData.action}
            onChange={(e) => {
              setFormData({
                ...formData,
                action: e.target.value,
                expiresAt: "",
              });
            }}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary transition-colors"
          >
            <option value="">None yet</option>
            <option value="warning">Warning</option>
            <option value="kick">Kick</option>
            <option value="temp_ban">Temp Ban</option>
            <option value="perm_ban">Perm Ban</option>
          </select>
        </div>
        {formData.action === "temp_ban" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Ban Expires At <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={formData.expiresAt}
              onChange={(e) =>
                setFormData({ ...formData, expiresAt: e.target.value })
              }
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Select when the temporary ban should expire
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          disabled={!userFound}
          className="flex-1 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Case
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white py-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

ModerationDashboard.layout = workspace;
export default ModerationDashboard;
