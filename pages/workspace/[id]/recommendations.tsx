import type { pageWithLayout } from "@/layoutTypes";
import { loginState, workspacestate } from "@/state";
import Workspace from "@/layouts/workspace";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRecoilState } from "recoil";
import Button from "@/components/button";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import prisma from "@/utils/database";
import moment from "moment";
import toast, { Toaster } from "react-hot-toast";
import { useRouter } from "next/router";
import axios from "axios";
import {
  IconSend,
  IconPhoto,
  IconX,
  IconArrowUp,
  IconSearch,
  IconLoader2,
  IconMessage,
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconArchive,
  IconBan,
  IconInbox,
  IconPencil,
  IconSortDescending,
  IconSortAscending,
} from "@tabler/icons-react";
import sanitizeHtml from "sanitize-html";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

const SANITIZE_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "recursiveEscape" as const,
};

type RecommendationComment = {
  id: string;
  recommendationId: string;
  authorId: string;
  authorName: string | null;
  authorPicture: string | null;
  content: string;
  image: string | null;
  createdAt: string;
};

type RecommendationVote = {
  id: string;
  recommendationId: string;
  userId: string;
  createdAt: string;
};

type Recommendation = {
  id: string;
  workspaceGroupId: number;
  targetUserId: string;
  targetUsername: string;
  targetPicture: string | null;
  reason: string;
  status: string;
  createdById: string;
  createdByName: string | null;
  editedById: string | null;
  editedByName: string | null;
  editedAt: string | null;
  statusChangedById: string | null;
  statusChangedByName: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  votes: RecommendationVote[];
  comments: RecommendationComment[];
};

export const getServerSideProps: GetServerSideProps = withPermissionCheckSsr(
  async ({ query, req }) => {
    const workspaceGroupId = parseInt(query.id as string);

    const config = await prisma.config.findFirst({
      where: { workspaceGroupId, key: "recommendations" },
    });
    let recommendationsEnabled = false;
    if (config?.value) {
      let val = config.value;
      if (typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {
          val = {};
        }
      }
      recommendationsEnabled =
        typeof val === "object" && val !== null && "enabled" in val
          ? ((val as { enabled?: boolean }).enabled ?? false)
          : false;
    }
    if (!recommendationsEnabled) {
      return { notFound: true };
    }

    const recommendations = await prisma.recommendation.findMany({
      where: { workspaceGroupId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: {
        votes: true,
        comments: { orderBy: { createdAt: "asc" } },
      },
    });

    const user = await prisma.user.findUnique({
      where: { userid: req.session.userid },
      include: {
        roles: {
          where: { workspaceGroupId },
          orderBy: { isOwnerRole: "desc" },
        },
        workspaceMemberships: {
          where: { workspaceGroupId },
        },
      },
    });

    const userPermissions = user?.roles?.[0]?.permissions || [];
    const userIsAdmin = user?.workspaceMemberships?.[0]?.isAdmin || false;

    return {
      props: {
        initialRecommendations: JSON.parse(
          JSON.stringify(recommendations, (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        ),
        userPermissions,
        userIsAdmin,
      },
    };
  },
  "view_recommendations",
);

type pageProps = {
  initialRecommendations: Recommendation[];
  userPermissions: string[];
  userIsAdmin: boolean;
};

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
  return BG_COLORS[(hash >>> 0) % BG_COLORS.length];
}

const STATUS_TABS = [
  { key: "active", label: "Active", icon: IconInbox },
  { key: "approved", label: "Approved", icon: IconCheck },
  { key: "rejected", label: "Rejected", icon: IconBan },
  { key: "archived", label: "Archived", icon: IconArchive },
] as const;

const Recommendations: pageWithLayout<pageProps> = (props) => {
  const router = useRouter();
  const { id } = router.query;
  const [login] = useRecoilState(loginState);
  const [workspace] = useRecoilState(workspacestate);

  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    props.initialRecommendations,
  );
  const [activeTab, setActiveTab] = useState<string>("active");
  const [loading, setLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [externalSearchResults, setExternalSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<{
    userId: string;
    username: string;
    picture?: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentImages, setCommentImages] = useState<
    Record<string, string | null>
  >({});
  const commentFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const [sortByVotes, setSortByVotes] = useState(false);
  const userPermissions = props.userPermissions;
  const userIsAdmin = props.userIsAdmin;
  const canPost =
    userIsAdmin || userPermissions.includes("post_recommendations");
  const canVote =
    userIsAdmin || userPermissions.includes("vote_recommendations");
  const canComment =
    userIsAdmin || userPermissions.includes("comment_recommendations");
  const canManage =
    userIsAdmin || userPermissions.includes("manage_recommendations");

  const loadRecommendations = async (status: string) => {
    setTabLoading(true);
    try {
      const res = await axios.get(
        `/api/workspace/${id}/recommendations?status=${status}`,
      );
      setRecommendations(res.data.recommendations);
    } catch {
      toast.error("Failed to load recommendations");
    }
    setTabLoading(false);
  };

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    loadRecommendations(tab);
  };
  const searchMembers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setExternalSearchResults([]);
      return;
    }
    try {
      const res = await axios.get(
        `/api/workspace/${id}/staff/search/${encodeURIComponent(query.trim())}`,
      );
      const users = (res.data?.users || []).map((u: any) => ({
        userId: (u.userid || "").toString(),
        username: u.username || "Unknown",
        picture: u.thumbnail || null,
      }));
      setSearchResults(users);
      setExternalSearchResults([]);
    } catch {
      setSearchResults([]);
    }
  };

  const searchExternally = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingExternal(true);
    try {
      const response = await axios.post("/api/roblox/id", {
        keyword: searchQuery.trim(),
      });
      if (response.data?.data?.length > 0) {
        const users = response.data.data.map((user: any) => ({
          userId: user.id.toString(),
          username: user.name,
          displayName: user.displayName,
          picture: `/api/workspace/${id}/avatar/${user.id}`,
        }));
        setExternalSearchResults(users);
      } else {
        setExternalSearchResults([]);
        toast.error("No Roblox users found");
      }
    } catch {
      toast.error("Failed to search Roblox");
      setExternalSearchResults([]);
    }
    setIsSearchingExternal(false);
  };

  const selectUser = (user: {
    userId: string;
    username: string;
    picture?: string;
  }) => {
    setSelectedUser(user);
    setSearchQuery("");
    setSearchResults([]);
    setExternalSearchResults([]);
  };

  const submitRecommendation = async () => {
    if (!selectedUser || !reason.trim()) {
      toast.error("Please select a user and provide a reason");
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`/api/workspace/${id}/recommendations`, {
        targetUserId: selectedUser.userId,
        targetUsername: selectedUser.username,
        reason: reason.trim(),
      });
      if (activeTab === "active") {
        setRecommendations([res.data.recommendation, ...recommendations]);
      }
      setSelectedUser(null);
      setReason("");
      setShowCreate(false);
      toast.success("Recommendation created!");
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Failed to create recommendation",
      );
    }
    setSubmitting(false);
  };

  const toggleVote = async (recId: string) => {
    try {
      const res = await axios.post(
        `/api/workspace/${id}/recommendations/${recId}/vote`,
      );
      setRecommendations((prev) =>
        prev.map((r) => {
          if (r.id !== recId) return r;
          if (res.data.voted) {
            return {
              ...r,
              votes: [
                ...r.votes,
                {
                  id: "temp",
                  recommendationId: recId,
                  userId: login.userId.toString(),
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          } else {
            return {
              ...r,
              votes: r.votes.filter(
                (v) => v.userId !== login.userId.toString(),
              ),
            };
          }
        }),
      );
    } catch {
      toast.error("Failed to vote");
    }
  };

  const submitComment = async (recId: string) => {
    const content = commentTexts[recId]?.trim();
    const image = commentImages[recId];
    if (!content && !image) return;

    try {
      const res = await axios.post(
        `/api/workspace/${id}/recommendations/${recId}/comment`,
        {
          content: content || "",
          image: image || undefined,
        },
      );
      setRecommendations((prev) =>
        prev.map((r) => {
          if (r.id !== recId) return r;
          return { ...r, comments: [...r.comments, res.data.comment] };
        }),
      );
      setCommentTexts((prev) => ({ ...prev, [recId]: "" }));
      setCommentImages((prev) => ({ ...prev, [recId]: null }));
      if (commentFileRefs.current[recId]) {
        commentFileRefs.current[recId]!.value = "";
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add comment");
    }
  };

  const handleCommentImage = (
    recId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPEG, PNG, GIF, and WEBP images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (typeof result === "string" && result.startsWith("data:image/")) {
        setCommentImages((prev) => ({ ...prev, [recId]: result }));
      } else {
        toast.error("Invalid image format.");
      }
    };
    reader.readAsDataURL(file);
  };

  const changeStatus = async (recId: string, newStatus: string) => {
    try {
      const res = await axios.put(
        `/api/workspace/${id}/recommendations/${recId}/status`,
        { status: newStatus },
      );
      setRecommendations((prev) => prev.filter((r) => r.id !== recId));
      toast.success(`Moved to ${newStatus}`);
    } catch {
      toast.error("Failed to change status");
    }
  };

  const saveEdit = async (recId: string) => {
    if (!editReason.trim()) return;
    try {
      const res = await axios.put(
        `/api/workspace/${id}/recommendations/${recId}`,
        { reason: editReason.trim() },
      );
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? res.data.recommendation : r)),
      );
      setEditingId(null);
      setEditReason("");
      toast.success("Recommendation updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const toggleCard = (recId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(recId)) next.delete(recId);
      else next.add(recId);
      return next;
    });
  };

  const toggleDropdown = (recId: string) => {
    setOpenDropdown(openDropdown === recId ? null : recId);
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    if (openDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openDropdown]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="pagePadding">
        <Toaster position="bottom-center" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-white">
              Recommendations
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Recommend members for promotion
            </p>
          </div>
          {canPost && (
            <Button
              classoverride="bg-primary hover:bg-primary/90 text-white dark:text-white px-4 dark:bg-primary dark:hover:bg-primary/80 whitespace-nowrap"
              workspace
              onPress={() => setShowCreate(!showCreate)}
            >
              <span className="sm:hidden">{showCreate ? "Cancel" : "New"}</span>
              <span className="hidden sm:inline">{showCreate ? "Cancel" : "New Recommendation"}</span>
            </Button>
          )}
        </div>

        {showCreate && canPost && (
          <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl shadow-sm p-5 mb-6">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">
              Create Recommendation
            </h2>
            {!selectedUser ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Search for user
                </label>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <IconSearch
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                      />
                      <input
                        type="text"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400"
                        placeholder="Search by username..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchMembers(e.target.value);
                        }}
                      />
                    </div>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((u: any) => (
                        <button
                          key={u.userId}
                          onClick={() => selectUser(u)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                        >
                          <img
                            src={
                              u.picture ||
                              `/api/workspace/${id}/avatar/${u.userId}`
                            }
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                          <span className="text-sm text-zinc-900 dark:text-white">
                            {u.username}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.length === 0 &&
                    searchQuery.trim() &&
                    !isSearchingExternal &&
                    externalSearchResults.length === 0 && (
                      <div className="mt-2">
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          User not found in workspace?{" "}
                        </span>
                        <button
                          onClick={searchExternally}
                          className="text-sm text-primary hover:underline"
                        >
                          Search externally
                        </button>
                      </div>
                    )}
                  {isSearchingExternal && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                      <IconLoader2 size={14} className="animate-spin" />{" "}
                      Searching Roblox...
                    </div>
                  )}
                  {externalSearchResults.length > 0 &&
                    searchResults.length === 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        <div className="px-3 py-1.5 text-xs text-zinc-400 uppercase tracking-wider">
                          Roblox Results
                        </div>
                        {externalSearchResults.map((u: any) => (
                          <button
                            key={u.userId}
                            onClick={() => selectUser(u)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                          >
                            <img
                              src={u.picture}
                              alt=""
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="text-left">
                              <span className="text-sm text-zinc-900 dark:text-white">
                                {u.username}
                              </span>
                              {u.displayName &&
                                u.displayName !== u.username && (
                                  <span className="text-xs text-zinc-400 ml-1">
                                    ({u.displayName})
                                  </span>
                                )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Selected user
                </label>
                <div className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
                  <img
                    src={
                      selectedUser.picture ||
                      `/api/workspace/${id}/avatar/${selectedUser.userId}`
                    }
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm text-zinc-900 dark:text-white font-medium">
                    {selectedUser.username}
                  </span>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="ml-auto p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <IconX size={16} />
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Reason for recommendation
              </label>
              <textarea
                className="w-full border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 rounded-lg p-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 resize-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="Why should this user be promoted?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={5000}
              />
            </div>

            <Button
              classoverride="bg-primary hover:bg-primary/90 text-white dark:text-white px-6 dark:bg-primary dark:hover:bg-primary/80"
              workspace
              onPress={submitRecommendation}
              loading={submitting}
            >
              Submit Recommendation
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-6">
          <div className="flex gap-0.5 sm:gap-1 flex-1 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl p-1">
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-sm font-medium transition-all whitespace-nowrap flex-1 sm:flex-initial ${
                    activeTab === tab.key
                      ? "bg-[color:rgb(var(--group-theme)/0.1)] text-[color:rgb(var(--group-theme))]"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  <Icon size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setSortByVotes(!sortByVotes)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
              sortByVotes
                ? "bg-[color:rgb(var(--group-theme)/0.1)] text-[color:rgb(var(--group-theme))] border-[color:rgb(var(--group-theme)/0.3)]"
                : "bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
            title={sortByVotes ? "Sorting by votes" : "Sort by votes"}
          >
            {sortByVotes ? (
              <IconSortDescending size={16} />
            ) : (
              <IconSortAscending size={16} />
            )}
            <span>Votes</span>
          </button>
        </div>

        {tabLoading && (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        )}

        {!tabLoading && recommendations.length === 0 && (
          <div className="text-center py-16">
            <IconInbox
              size={48}
              className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3"
            />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              No {activeTab} recommendations
            </p>
          </div>
        )}

        {!tabLoading && (
          <div className="space-y-4">
            {(sortByVotes
              ? [...recommendations].sort(
                  (a, b) => b.votes.length - a.votes.length,
                )
              : recommendations
            ).map((rec) => {
              const isExpanded = expandedCards.has(rec.id);
              const hasVoted = rec.votes.some(
                (v) => v.userId === login.userId.toString(),
              );
              const isEditing = editingId === rec.id;
              const isLocked = rec.status !== "active";
              const canVoteHere = (canVote && !isLocked) || canManage;
              const canCommentHere = (canComment && !isLocked) || canManage;

              return (
                <div
                  key={rec.id}
                  className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl shadow-sm"
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden ${getRandomBg(rec.targetUserId)}`}
                      >
                        {rec.targetPicture ? (
                          <img
                            src={rec.targetPicture}
                            alt=""
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                          />
                        ) : (
                          <img
                            src={`/api/workspace/${id}/avatar/${rec.targetUserId}`}
                            alt=""
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white break-all">
                            {rec.targetUsername}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              rec.status === "active"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : rec.status === "approved"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : rec.status === "rejected"
                                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                            }`}
                          >
                            {rec.status.charAt(0).toUpperCase() +
                              rec.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 break-words">
                          <span className="sm:hidden">Posted by {rec.createdByName || "Unknown"}</span>
                          <span className="hidden sm:inline">Recommended by {rec.createdByName || "Unknown"}</span>
                        </p>
                        {rec.statusChangedByName && rec.status !== "active" && (
                          <p className="text-xs text-zinc-400 mt-0.5 break-words">
                            {rec.status.charAt(0).toUpperCase() +
                              rec.status.slice(1)}{" "}
                            by {rec.statusChangedByName}
                          </p>
                        )}
                        {isEditing ? (
                          <div className="mt-3">
                            <textarea
                              className="w-full border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 rounded-lg p-2 text-sm text-zinc-900 dark:text-white resize-none focus:ring-1 focus:ring-primary"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              rows={3}
                              maxLength={5000}
                            />
                            <div className="flex gap-2 mt-2">
                              <Button
                                classoverride="bg-primary text-white text-xs px-3 py-1"
                                workspace
                                onPress={() => saveEdit(rec.id)}
                              >
                                Save
                              </Button>
                              <Button
                                classoverride="bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200 text-xs px-3 py-1"
                                onPress={() => {
                                  setEditingId(null);
                                  setEditReason("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                                {rec.reason}
                              </ReactMarkdown>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1.5">
                              {moment(rec.createdAt).fromNow()}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {canVoteHere ? (
                          <button
                            onClick={() => toggleVote(rec.id)}
                            className={`flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                              hasVoted
                                ? "bg-[color:rgb(var(--group-theme)/0.1)] text-[color:rgb(var(--group-theme))]"
                                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                            }`}
                          >
                            <IconArrowUp size={14} className="sm:w-4 sm:h-4" />
                            <span>{rec.votes.length}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                            <IconArrowUp size={14} className="sm:w-4 sm:h-4" />
                            <span>{rec.votes.length}</span>
                          </div>
                        )}

                        <button
                          onClick={() => toggleCard(rec.id)}
                          className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition"
                        >
                          <IconMessage size={14} className="sm:w-4 sm:h-4" />
                          <span>{rec.comments.length}</span>
                          {isExpanded ? (
                            <IconChevronUp
                              size={12}
                              className="sm:w-3.5 sm:h-3.5"
                            />
                          ) : (
                            <IconChevronDown
                              size={12}
                              className="sm:w-3.5 sm:h-3.5"
                            />
                          )}
                        </button>

                        {canManage && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDropdown(rec.id);
                              }}
                              className="p-1.5 sm:p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <circle cx="8" cy="3" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="8" cy="13" r="1.5" />
                              </svg>
                            </button>
                            {openDropdown === rec.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50">
                                <button
                                  onClick={() => {
                                    setEditingId(rec.id);
                                    setEditReason(rec.reason);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-t-lg"
                                >
                                  <IconPencil size={14} /> Edit Reason
                                </button>
                                {rec.status !== "active" && (
                                  <button
                                    onClick={() => {
                                      changeStatus(rec.id, "active");
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                                  >
                                    <IconInbox size={14} /> Move to Active
                                  </button>
                                )}
                                {rec.status !== "approved" && (
                                  <button
                                    onClick={() => {
                                      changeStatus(rec.id, "approved");
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                                  >
                                    <IconCheck size={14} /> Approve
                                  </button>
                                )}
                                {rec.status !== "rejected" && (
                                  <button
                                    onClick={() => {
                                      changeStatus(rec.id, "rejected");
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                                  >
                                    <IconBan size={14} /> Reject
                                  </button>
                                )}
                                {rec.status !== "archived" && (
                                  <button
                                    onClick={() => {
                                      changeStatus(rec.id, "archived");
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-b-lg"
                                  >
                                    <IconArchive size={14} /> Archive
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-zinc-100 dark:border-zinc-700">
                      {rec.comments.length > 0 && (
                        <div className="px-4 pt-3 space-y-3">
                          {rec.comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden ${getRandomBg(comment.authorId)}`}
                              >
                                {comment.authorPicture ? (
                                  <img
                                    src={comment.authorPicture}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={`/api/workspace/${id}/avatar/${comment.authorId}`}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3">
                                  <p className="text-xs font-medium text-zinc-900 dark:text-white">
                                    {comment.authorName || "Unknown"}
                                    <span className="text-zinc-400 font-normal ml-2">
                                      {moment(comment.createdAt).fromNow()}
                                    </span>
                                  </p>
                                  {comment.content && (
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">
                                      {comment.content}
                                    </p>
                                  )}
                                  {comment.image && (
                                    <img
                                      src={comment.image}
                                      alt="Comment attachment"
                                      className="mt-2 max-h-48 rounded-lg object-contain"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canCommentHere && (
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden ${getRandomBg(login.userId.toString())}`}
                            >
                              <img
                                src={login.thumbnail}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <textarea
                                className="w-full border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 rounded-lg p-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 resize-none focus:ring-1 focus:ring-primary"
                                placeholder="Add a comment..."
                                value={commentTexts[rec.id] || ""}
                                onChange={(e) =>
                                  setCommentTexts((prev) => ({
                                    ...prev,
                                    [rec.id]: e.target.value,
                                  }))
                                }
                                rows={2}
                                maxLength={5000}
                              />
                              {commentImages[rec.id] && (
                                <div className="relative mt-2">
                                  <img
                                    src={commentImages[rec.id]!}
                                    alt="Selected"
                                    className="max-h-32 rounded-lg object-contain"
                                  />
                                  <button
                                    onClick={() => {
                                      setCommentImages((prev) => ({
                                        ...prev,
                                        [rec.id]: null,
                                      }));
                                      if (commentFileRefs.current[rec.id])
                                        commentFileRefs.current[rec.id]!.value =
                                          "";
                                    }}
                                    className="absolute top-1 right-1 p-0.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                                  >
                                    <IconX size={12} />
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    ref={(el) => {
                                      commentFileRefs.current[rec.id] = el;
                                    }}
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={(e) =>
                                      handleCommentImage(rec.id, e)
                                    }
                                  />
                                  <button
                                    onClick={() =>
                                      commentFileRefs.current[rec.id]?.click()
                                    }
                                    className="p-1.5 text-zinc-400 hover:text-primary rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-600 transition"
                                  >
                                    <IconPhoto size={16} />
                                  </button>
                                </div>
                                <button
                                  onClick={() => submitComment(rec.id)}
                                  className="p-1.5 text-primary hover:bg-[color:rgb(var(--group-theme)/0.1)] rounded-lg transition"
                                >
                                  <IconSend size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

Recommendations.layout = Workspace;
export default Recommendations;