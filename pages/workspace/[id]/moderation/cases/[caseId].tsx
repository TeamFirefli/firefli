import workspace from "@/layouts/workspace";
import { pageWithLayout } from "@/layoutTypes";
import axios from "axios";
import { useRouter } from "next/router";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import prisma from "@/utils/database";
import { getConfig } from "@/utils/configEngine";
import { fetchGroupGames } from "@/utils/roblox";
import moment from "moment";
import Tooltip from "@/components/tooltip";
import { useRecoilValue } from "recoil";
import { workspacestate } from "@/state";
import { loginState } from "@/state";
import { Listbox } from "@headlessui/react";
import {
  IconShield,
  IconAlertTriangle,
  IconBan,
  IconCheck,
  IconX,
  IconUpload,
  IconFileText,
  IconDownload,
  IconTrash,
  IconArrowLeft,
  IconClock,
  IconLink,
  IconEye,
  IconPencil,
  IconChevronDown,
  IconDeviceGamepad2,
} from "@tabler/icons-react";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800",
  resolved:
    "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-600",
  archived:
    "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-600",
  appealed:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  revoked:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

interface CaseData {
  id: string;
  workspaceGroupId: string;
  targetUserId: string;
  targetUsername?: string;
  reportedBy?: string;
  createdBy: string;
  reason: string;
  description?: string;
  status: string;
  action?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  expiresAt?: string;
  internalNotes?: string;
  publicNote?: string;
  banDuration?: number;
  isPermanent?: boolean;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  placeIds?: string[];
  targetUser?: {
    userid: string;
    username?: string;
    picture?: string;
    displayName?: string;
  };
  createdByUser?: {
    userid: string;
    username?: string;
    picture?: string;
    displayName?: string;
  };
  resolvedByUser?: {
    userid: string;
    username?: string;
    picture?: string;
    displayName?: string;
  };
  reportedByUser?: {
    userid: string;
    username?: string;
    picture?: string;
    displayName?: string;
  };
  revokedByUser?: {
    userid: string;
    username?: string;
    picture?: string;
    displayName?: string;
  };
  evidence: Array<{
    id: string;
    uploadedBy: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    description?: string;
    createdAt: string;
    uploader?: {
      userid: string;
      username?: string;
      picture?: string;
    };
  }>;
}

interface LogData {
  id: string;
  action: string;
  actionBy: string;
  createdAt: string;
  actor?: {
    userid: string;
    username?: string;
    picture?: string;
  };
}

interface CaseDetailProps {
  case: CaseData;
  logs: LogData[];
  games: Array<{ name: string; id: number }>;
}

export const getServerSideProps = withPermissionCheckSsr(
  async ({ params, req }) => {
    const userId = req.session?.userid;
    const groupId = BigInt(params?.id as string);
    const caseId = params?.caseId as string;

    const moderationConfig = await getConfig('moderation', groupId);
    if (!moderationConfig?.enabled) {
      return { notFound: true };
    }

    if (!userId) {
      return { notFound: true };
    }

    try {
      const moderationCase = await prisma.moderationCase.findFirst({
        where: {
          id: caseId,
          workspaceGroupId: groupId,
        },
        include: {
          targetUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          createdByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          resolvedByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          reportedByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          revokedByUser: {
            select: {
              userid: true,
              username: true,
              picture: true,
              displayName: true,
            },
          },
          evidence: {
            include: {
              uploader: {
                select: {
                  userid: true,
                  username: true,
                  picture: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!moderationCase) {
        return { notFound: true };
      }

      const logs = await prisma.moderationLog.findMany({
        where: {
          caseId: caseId,
          workspaceGroupId: groupId,
        },
        include: {
          actor: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      });

      let games: Array<{ name: string; id: number }> = [];
      try {
        const fetchedGames = await fetchGroupGames(Number(groupId));
        games = fetchedGames
          .filter((game: any) => game.rootPlaceId)
          .map((game: any) => ({ name: game.name, id: Number(game.rootPlaceId) }))
          .filter((game: any) => !isNaN(game.id) && game.id > 0);
      } catch {
        // games will be empty; display will fall back to place IDs
      }

      return {
        props: {
          case: JSON.parse(
            JSON.stringify(moderationCase, (_, value) =>
              typeof value === "bigint" ? value.toString() : value,
            ),
          ),
          logs: JSON.parse(
            JSON.stringify(logs, (_, value) =>
              typeof value === "bigint" ? value.toString() : value,
            ),
          ),
          games,
        },
      };
    } catch (error) {
      console.error("Error fetching case:", error);
      return { notFound: true };
    }
  },
  ["view_moderation"],
);

const CaseDetailPage: pageWithLayout<CaseDetailProps> = ({
  case: caseData,
  logs,
  games,
}) => {
  const router = useRouter();
  const { id: workspaceId, caseId } = router.query;
  const workspaceData = useRecoilValue(workspacestate);
  const userState = useRecoilValue(loginState);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "link">("file");
  const [videoLink, setVideoLink] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEvidence, setPreviewEvidence] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [evidenceToDelete, setEvidenceToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteCaseModal, setShowDeleteCaseModal] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editReason, setEditReason] = useState(caseData.reason);
  const [editDescription, setEditDescription] = useState(caseData.description ?? "");
  const [editSelectedGameIds, setEditSelectedGameIds] = useState<number[]>(
    (caseData.placeIds ?? []).map(Number).filter((n) => !isNaN(n) && n > 0)
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const canExecutePunishments =
    workspaceData.yourPermission?.includes("execute_punishments") ||
    workspaceData.isAdmin;
  const canRevokePunishments =
    workspaceData.yourPermission?.includes("revoke_punishments") ||
    workspaceData.isAdmin;
  const canEditCase =
    workspaceData.yourPermission?.includes("edit_moderation_cases") ||
    workspaceData.isAdmin ||
    caseData.createdBy === userState.userId?.toString();
  const canDeleteCase =
    workspaceData.yourPermission?.includes("delete_moderation_cases") ||
    workspaceData.isAdmin;

  const handleEditCase = async () => {
    if (!editReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSavingEdit(true);
    try {
      const response = await axios.put(
        `/api/workspace/${workspaceId}/moderation/cases/${caseId}`,
        {
          reason: editReason.trim(),
          description: editDescription.trim() || undefined,
          placeIds: editSelectedGameIds.map(String),
        },
      );
      if (response.data.success) {
        toast.success("Case updated!");
        setShowEditModal(false);
        router.replace(router.asPath);
      } else {
        toast.error(response.data.error || "Failed to update case.");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update case.");
    } finally {
      setSavingEdit(false);
    }
  };

  const isBanAction =
    caseData.action === "temp_ban" || caseData.action === "perm_ban";
  const isKickAction = caseData.action === "kick";
  const validateVideoLink = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/,
      /^https?:\/\/medal\.tv\/.+$/,
      /^https?:\/\/drive\.google\.com\/.+$/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };
  const handleUploadEvidence = async () => {
    if (uploadType === "file") {
      if (!evidenceFile) {
        toast.error("Please select a file");
        return;
      }
    } else {
      if (!videoLink.trim()) {
        toast.error("Please enter a video link");
        return;
      }
      if (!validateVideoLink(videoLink)) {
        toast.error(
          "Invalid video link. Please use YouTube, Medal.tv, or Google Drive.",
        );
        return;
      }
    }

    setUploadingEvidence(true);
    try {
      if (uploadType === "link") {
        // For video links, send as external URL
        const response = await axios.post(
          `/api/workspace/${workspaceId}/moderation/cases/${caseId}/evidence`,
          {
            fileName: "Video Link",
            fileUrl: videoLink,
            isExternalLink: true,
            description: evidenceDescription,
          },
        );

        if (response.data.success) {
          toast.success("Video link added successfully");
          setShowEvidenceModal(false);
          setVideoLink("");
          setEvidenceDescription("");
          setUploadType("file");
          router.replace(router.asPath);
        } else {
          toast.error(response.data.error || "Failed to add video link");
        }
        setUploadingEvidence(false);
      } else {
        // For file uploads
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const response = await axios.post(
              `/api/workspace/${workspaceId}/moderation/cases/${caseId}/evidence`,
              {
                fileName: evidenceFile!.name,
                fileData: base64,
                description: evidenceDescription,
              },
            );

            if (response.data.success) {
              toast.success("Evidence uploaded successfully");
              setShowEvidenceModal(false);
              setEvidenceFile(null);
              setEvidenceDescription("");
              router.replace(router.asPath);
            } else {
              toast.error(response.data.error || "Failed to upload evidence");
            }
          } catch (uploadError: any) {
            const errorMessage =
              uploadError.response?.data?.error || "Failed to upload evidence";
            toast.error(errorMessage);
          } finally {
            setUploadingEvidence(false);
          }
        };
        reader.onerror = () => {
          toast.error("Failed to read file");
          setUploadingEvidence(false);
        };
        reader.readAsDataURL(evidenceFile!);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || "Failed to upload evidence";
      toast.error(errorMessage);
      setUploadingEvidence(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const allowedTypes = ["image/", "video/"];
      if (allowedTypes.some((type) => file.type.startsWith(type))) {
        setEvidenceFile(file);
      } else {
        toast.error("Invalid file type. Please upload an image, or video.");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setEvidenceFile(files[0]);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const response = await axios.put(
        `/api/workspace/${workspaceId}/moderation/cases/${caseId}`,
        { status },
      );

      if (response.data.success) {
        toast.success("Status updated successfully");
        router.replace(router.asPath);
      }
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleExecuteBan = async () => {
    try {
      const response = await axios.post(
        `/api/workspace/${workspaceId}/moderation/bans`,
        {
          userId: caseData.targetUserId,
          username: caseData.targetUsername,
          reason: caseData.reason,
          duration: caseData.banDuration,
          expiresAt: caseData.expiresAt,
          isPermanent: caseData.action === "perm_ban",
          caseId,
        },
      );

      if (response.data.success) {
        toast.success("Ban executed successfully");
        router.replace(router.asPath);
      }
    } catch (error) {
      toast.error("Failed to execute ban");
    }
  };

  const handleExecuteKick = async () => {
    try {
      const response = await axios.post(
        `/api/workspace/${workspaceId}/moderation/cases/${caseId}/execute-kick`,
      );

      if (response.data.success) {
        toast.success("Kick executed successfully");
        router.replace(router.asPath);
      }
    } catch (error) {
      toast.error("Failed to execute kick");
    }
  };

  const handleRevoke = async () => {
    if (!revokeReason.trim()) {
      toast.error("Please provide a reason for revocation");
      return;
    }

    setRevoking(true);
    try {
      const response = await axios.post(
        `/api/workspace/${workspaceId}/moderation/cases/${caseId}/revoke`,
        { reason: revokeReason },
      );

      if (response.data.success) {
        toast.success("Case action revoked successfully");
        setShowRevokeModal(false);
        setRevokeReason("");
        router.replace(router.asPath);
      }
    } catch (error) {
      toast.error("Failed to revoke case action");
    } finally {
      setRevoking(false);
    }
  };

  const handleDeleteCase = async () => {
    setDeletingCase(true);
    try {
      const response = await axios.delete(
        `/api/workspace/${workspaceId}/moderation/cases/${caseId}`,
      );
      if (response.data.success) {
        toast.success("Case deleted successfully");
        router.push(`/workspace/${workspaceId}/moderation`);
      } else {
        toast.error(response.data.error || "Failed to delete case");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete case");
    } finally {
      setDeletingCase(false);
    }
  };

  const handleDeleteEvidence = async () => {
    if (!evidenceToDelete) return;

    setDeleting(true);
    try {
      const response = await axios.delete(
        `/api/workspace/${workspaceId}/moderation/cases/${caseId}/evidence/${evidenceToDelete.id}`,
      );

      if (response.data.success) {
        toast.success("Evidence deleted successfully");
        setShowDeleteModal(false);
        setEvidenceToDelete(null);
        router.replace(router.asPath);
      } else {
        toast.error(response.data.error || "Failed to delete evidence");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || "Failed to delete evidence";
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Toaster position="bottom-center" />

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/workspace/${workspaceId}/moderation`)}
          className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-4 transition-colors"
        >
          <IconArrowLeft size={20} />
          Back to Cases
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Case Details
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Case ID: {caseId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditCase && (
              <Tooltip orientation="bottom" tooltipText="Edit reason, description, and place restrictions">
                <button
                  onClick={() => {
                    setEditReason(caseData.reason);
                    setEditDescription(caseData.description ?? "");
                    setEditSelectedGameIds(
                      (caseData.placeIds ?? []).map(Number).filter((n) => !isNaN(n) && n > 0)
                    );
                    setShowEditModal(true);
                  }}
                  className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                >
                  <IconPencil size={18} />
                  <span>Edit Case</span>
                </button>
              </Tooltip>
            )}
            {canDeleteCase && (
              <Tooltip
                orientation="bottom"
                tooltipText="Permanently delete this case"
              >
                <button
                  onClick={() => setShowDeleteCaseModal(true)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                >
                  <IconTrash size={18} />
                  <span>Delete Case</span>
                </button>
              </Tooltip>
            )}
            {caseData.action && !caseData.revokedAt && canRevokePunishments && (
              <Tooltip
                orientation="bottom"
                tooltipText="Revoke this case action"
              >
                <button
                  onClick={() => setShowRevokeModal(true)}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                >
                  <IconX size={18} />
                  <span>Revoke Action</span>
                </button>
              </Tooltip>
            )}
            {caseData.status === "open" &&
              canExecutePunishments &&
              !caseData.revokedAt && (
                <>
                  {isBanAction && (
                    <Tooltip
                      orientation="bottom"
                      tooltipText="Execute the ban for this user"
                    >
                      <button
                        onClick={handleExecuteBan}
                        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                      >
                        <IconBan size={18} />
                        <span>Execute Ban</span>
                      </button>
                    </Tooltip>
                  )}

                  {isKickAction && (
                    <Tooltip
                      orientation="bottom"
                      tooltipText="Mark this kick as executed"
                    >
                      <button
                        onClick={handleExecuteKick}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                      >
                        <IconAlertTriangle size={18} />
                        <span>Execute Kick</span>
                      </button>
                    </Tooltip>
                  )}
                </>
              )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-800 border border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
              Case Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={
                    caseData.targetUser?.picture ||
                    `/api/workspace/${workspaceId}/avatar/${caseData.targetUserId}`
                  }
                  alt=""
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full ring-2 ring-white dark:ring-zinc-700"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white truncate">
                    {caseData.targetUsername ||
                      caseData.targetUser?.username ||
                      "Unknown"}
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    User ID: {caseData.targetUserId}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Status
                </div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                    caseData.revokedAt
                      ? STATUS_COLORS["revoked"]
                      : STATUS_COLORS[caseData.status] ||
                        "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  }`}
                >
                  {caseData.revokedAt
                    ? "Revoked"
                    : caseData.status.charAt(0).toUpperCase() +
                      caseData.status.slice(1)}
                </span>
              </div>

              {caseData.action && (
                <div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Punishment Type
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                      caseData.action === "kick"
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                        : caseData.action === "warning"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                        : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
                    }`}
                  >
                    {caseData.action === "kick"
                      ? "Kick"
                      : caseData.action === "warning"
                      ? "Warning"
                      : caseData.action === "temp_ban"
                      ? "Temporary Ban"
                      : caseData.action === "perm_ban"
                      ? "Permanent Ban"
                      : caseData.action.charAt(0).toUpperCase() + caseData.action.slice(1)}
                  </span>
                </div>
              )}
              
              <div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Reason
                </div>
                <div className="text-lg text-zinc-900 dark:text-white">
                  {caseData.reason}
                </div>
              </div>

              {caseData.description && (
                <div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Description
                  </div>
                  <div className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                    {caseData.description}
                  </div>
                </div>
              )}

              {caseData.internalNotes && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    Internal Notes
                  </div>
                  <div className="text-sm text-yellow-900 dark:text-yellow-200">
                    {caseData.internalNotes}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Affected Places
                </div>
                {!caseData.placeIds || caseData.placeIds.length === 0 ? (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                    All places
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {caseData.placeIds.map((pid) => {
                      const game = games.find((g) => g.id.toString() === pid);
                      return (
                        <a
                          key={pid}
                          href={`https://www.roblox.com/games/${pid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          {game ? game.name : pid}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-white dark:bg-zinc-800 border border-white/10 rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Evidence
              </h2>
              <button
                onClick={() => setShowEvidenceModal(true)}
                disabled={uploadingEvidence}
                className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium w-full sm:w-auto"
              >
                <IconUpload size={16} />
                Upload Evidence
              </button>
            </div>

            {caseData.evidence.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <IconFileText
                    className="text-primary"
                    size={32}
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                  No Evidence Yet
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Upload images, videos, or add links to document this case.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {caseData.evidence.map((ev: any) => {
                  const isExternalLink = ev.fileType === "external_link";
                  const isImage = ev.fileType?.startsWith("image/");
                  const isVideo = ev.fileType?.startsWith("video/");
                  const canPreview = isImage || isVideo || isExternalLink;
                  const isUploader =
                    ev.uploadedBy?.toString() === userState.userId?.toString();
                  const canDeleteEvidence = isUploader || canEditCase;

                  return (
                    <div
                      key={ev.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isExternalLink ? (
                          <IconLink className="text-primary flex-shrink-0" size={24} />
                        ) : (
                          <IconFileText
                            className="text-zinc-400 dark:text-zinc-500 flex-shrink-0"
                            size={24}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-zinc-900 dark:text-white truncate">
                            {ev.fileName}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {isExternalLink ? (
                              <>
                                External Link •{" "}
                                {moment(ev.createdAt).format("MMM D, YYYY")} •{" "}
                                {ev.uploader?.username}
                              </>
                            ) : (
                              <>
                                {(ev.fileSize / 1024).toFixed(1)} KB •{" "}
                                {moment(ev.createdAt).format("MMM D, YYYY")} •{" "}
                                {ev.uploader?.username}
                              </>
                            )}
                          </div>
                          {ev.description && (
                            <div className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-2">
                              {ev.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end sm:justify-start">
                        {canPreview && (
                          <Tooltip orientation="left" tooltipText="Preview">
                            <button
                              onClick={() => {
                                setPreviewEvidence(ev);
                                setShowPreviewModal(true);
                              }}
                              className="text-primary hover:text-primary/80 transition-colors p-1"
                            >
                              <IconEye size={18} />
                            </button>
                          </Tooltip>
                        )}
                        {!isExternalLink && (
                          <Tooltip orientation="left" tooltipText="Download">
                            <a
                              href={ev.fileUrl}
                              download
                              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors p-1"
                            >
                              <IconDownload size={18} />
                            </a>
                          </Tooltip>
                        )}
                        {canDeleteEvidence && (
                          <Tooltip orientation="left" tooltipText="Delete">
                            <button
                              onClick={() => {
                                setEvidenceToDelete(ev);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1"
                            >
                              <IconTrash size={18} />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timestamps */}
          <div className="bg-white dark:bg-zinc-800 border border-white/10 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3">
              Timestamps
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Created</div>
                <div className="font-medium text-zinc-900 dark:text-white">
                  {moment(caseData.createdAt).format("MMM D, YYYY [at] h:mm A")}
                </div>
              </div>
              {caseData.resolvedAt && (
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    Resolved
                  </div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {moment(caseData.resolvedAt).format(
                      "MMM D, YYYY [at] h:mm A",
                    )}
                  </div>
                </div>
              )}
              {caseData.expiresAt && (
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    Expires
                  </div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {moment(caseData.expiresAt).format(
                      "MMM D, YYYY [at] h:mm A",
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Staff */}
          <div className="bg-white dark:bg-zinc-800 border border-white/10 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3">
              Staff
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-zinc-500 dark:text-zinc-400 mb-1">
                  Created By
                </div>
                <div className="flex items-center gap-2">
                  <img
                    src={
                      caseData.createdByUser?.picture ||
                      `/api/workspace/${workspaceId}/avatar/${caseData.createdBy}`
                    }
                    alt=""
                    className="w-6 h-6 rounded-full ring-1 ring-white dark:ring-zinc-700"
                  />
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {caseData.createdByUser?.username || "Unknown"}
                  </span>
                </div>
              </div>
              {caseData.resolvedByUser && (
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400 mb-1">
                    Resolved By
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src={
                        caseData.resolvedByUser?.picture ||
                        `/api/workspace/${workspaceId}/avatar/${caseData.resolvedBy}`
                      }
                      alt=""
                      className="w-6 h-6 rounded-full ring-1 ring-white dark:ring-zinc-700"
                    />
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {caseData.resolvedByUser?.username || "Unknown"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!caseData.revokedAt &&
            (caseData.action === "temp_ban" ||
              caseData.action === "perm_ban") && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <h3 className="font-bold text-red-900 dark:text-red-300 mb-2">
                  Ban Details
                </h3>

                <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                  <div>
                    Type:{" "}
                    {caseData.action === "perm_ban"
                      ? "Permanent Ban"
                      : "Temporary Ban"}
                  </div>

                  {caseData.expiresAt && (
                    <div>
                      Expires:{" "}
                      {moment(caseData.expiresAt).format(
                        "MMM D, YYYY [at] h:mm A",
                      )}{" "}
                      ({moment(caseData.expiresAt).fromNow()})
                    </div>
                  )}
                </div>
              </div>
            )}

          {caseData.revokedAt && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <h3 className="font-bold text-orange-900 dark:text-orange-300 mb-2">
                Action Revoked
              </h3>
              <div className="space-y-2 text-sm text-orange-800 dark:text-orange-200">
                <div>
                  Revoked by: {caseData.revokedByUser?.username || "Unknown"}
                </div>
                <div>
                  Revoked at:{" "}
                  {moment(caseData.revokedAt).format("MMM D, YYYY [at] h:mm A")}
                </div>
                {caseData.revokeReason && (
                  <div>
                    <div className="font-medium mb-1">Reason:</div>
                    <div className="whitespace-pre-wrap">
                      {caseData.revokeReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showRevokeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-white/10">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
              Revoke Action
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              This will revoke the action for this case. Please provide a reason
              for the revocation.
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

      {showEvidenceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl border border-white/10">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
              Add Evidence
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Upload and evidence videos or images.
            </p>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-4 bg-zinc-100 dark:bg-zinc-700/50 p-1 rounded-lg">
              <button
                onClick={() => setUploadType("file")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  uploadType === "file"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setUploadType("link")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  uploadType === "link"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Video Link
              </button>
            </div>

            <div className="space-y-4">
              {uploadType === "file" ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-zinc-300 dark:border-zinc-600 hover:border-primary dark:hover:border-primary"
                  }`}
                >
                  {evidenceFile ? (
                    <div className="space-y-2">
                      <IconFileText
                        className="mx-auto text-primary"
                        size={48}
                      />
                      <div className="font-medium text-zinc-900 dark:text-white">
                        {evidenceFile.name}
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {(evidenceFile.size / 1024).toFixed(1)} KB
                      </div>
                      <button
                        onClick={() => setEvidenceFile(null)}
                        className="text-sm text-red-500 hover:text-red-600 transition-colors"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <IconUpload
                        className="mx-auto text-zinc-400 dark:text-zinc-500"
                        size={48}
                      />
                      <div className="text-zinc-900 dark:text-white font-medium">
                        Drag and drop your file here
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        or click to browse
                      </div>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="evidence-file-input"
                      />
                      <label
                        htmlFor="evidence-file-input"
                        className="inline-block mt-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors cursor-pointer text-sm font-medium"
                      >
                        Browse Files
                      </label>
                      <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                        Supported: Images and Videos (Max 10MB)
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Video URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={videoLink}
                    onChange={(e) => setVideoLink(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                    placeholder="https://youtube.com/watch?v=..."
                  />
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Supported platforms: YouTube, Medal.tv, Google Drive
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Description <span className="text-zinc-400">(Optional)</span>
                </label>
                <textarea
                  value={evidenceDescription}
                  onChange={(e) => setEvidenceDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
                  rows={3}
                  placeholder="Add a description for this evidence..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUploadEvidence}
                disabled={
                  uploadingEvidence ||
                  (uploadType === "file" ? !evidenceFile : !videoLink.trim())
                }
                className="flex-1 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingEvidence
                  ? uploadType === "file"
                    ? "Uploading..."
                    : "Adding..."
                  : uploadType === "file"
                    ? "Upload Evidence"
                    : "Add Video Link"}
              </button>
              <button
                onClick={() => {
                  setShowEvidenceModal(false);
                  setEvidenceFile(null);
                  setEvidenceDescription("");
                  setVideoLink("");
                  setIsDragging(false);
                  setUploadType("file");
                }}
                disabled={uploadingEvidence}
                className="px-6 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white py-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && previewEvidence && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative max-w-6xl w-full mx-4">
            <button
              onClick={() => {
                setShowPreviewModal(false);
                setPreviewEvidence(null);
              }}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition-colors z-10"
            >
              <IconX size={24} />
            </button>

            <div className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden shadow-xl border border-white/10 max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {previewEvidence.fileName}
                </h2>
                {previewEvidence.description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {previewEvidence.description}
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/50">
                {previewEvidence.fileType === "external_link" ? (
                  <div className="text-center">
                    <IconLink className="mx-auto mb-4 text-primary" size={48} />
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                      External video link
                    </p>
                    <a
                      href={previewEvidence.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                    >
                      <IconLink size={18} />
                      Open Video Link
                    </a>
                  </div>
                ) : previewEvidence.fileType?.startsWith("image/") ? (
                  <img
                    src={previewEvidence.fileUrl}
                    alt={previewEvidence.fileName}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : previewEvidence.fileType?.startsWith("video/") ? (
                  <video
                    src={previewEvidence.fileUrl}
                    controls
                    className="max-w-full max-h-full rounded-lg"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-center text-zinc-600 dark:text-zinc-400">
                    <IconFileText className="mx-auto mb-4" size={48} />
                    <p>Preview not available for this file type</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {previewEvidence.fileType !== "external_link" && (
                    <>{(previewEvidence.fileSize / 1024).toFixed(1)} KB • </>
                  )}
                  Uploaded by {previewEvidence.uploader?.username} on{" "}
                  {moment(previewEvidence.createdAt).format("MMM D, YYYY")}
                </div>
                {previewEvidence.fileType !== "external_link" && (
                  <a
                    href={previewEvidence.fileUrl}
                    download
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    <IconDownload size={16} />
                    Download
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteCaseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                <IconTrash className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Delete Case
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Are you sure you want to permanently delete this case? This will also remove any linked bans and evidence. This action cannot be undone.
            </p>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 mb-6">
              <div className="font-medium text-zinc-900 dark:text-white mb-1">
                {caseData.targetUsername || caseData.targetUser?.username || `User ${caseData.targetUserId}`}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                {caseData.reason}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteCase}
                disabled={deletingCase}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingCase ? "Deleting..." : "Delete Case"}
              </button>
              <button
                onClick={() => setShowDeleteCaseModal(false)}
                disabled={deletingCase}
                className="px-6 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white py-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && evidenceToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                <IconTrash
                  className="text-red-600 dark:text-red-400"
                  size={24}
                />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Delete Evidence
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Are you sure you want to delete this evidence? This action cannot
              be undone.
            </p>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 mb-6">
              <div className="font-medium text-zinc-900 dark:text-white mb-1">
                {evidenceToDelete.fileName}
              </div>
              {evidenceToDelete.description && (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {evidenceToDelete.description}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteEvidence}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete Evidence"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEvidenceToDelete(null);
                }}
                disabled={deleting}
                className="px-6 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white py-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl border border-white/10">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-primary/10 p-2 rounded-lg">
                <IconPencil className="text-primary" size={22} />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Edit Case
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                  placeholder="Brief reason for case"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
                  rows={3}
                  placeholder="Detailed description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Affected Places
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  Restrict this action to specific experiences.
                </p>
                {games.length > 0 ? (
                  <div className="relative">
                    <Listbox value={editSelectedGameIds} onChange={setEditSelectedGameIds} multiple>
                      <Listbox.Button className="flex items-center justify-between w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-left focus:ring-2 focus:ring-primary focus:border-transparent transition-colors">
                        <span className="flex items-center gap-2 truncate text-sm text-zinc-700 dark:text-zinc-300">
                          <IconDeviceGamepad2 size={16} className="text-zinc-400 flex-shrink-0" />
                          {editSelectedGameIds.length === 0
                            ? "All experiences"
                            : editSelectedGameIds.length === 1
                            ? games.find((g) => g.id === editSelectedGameIds[0])?.name ?? `Experience ${editSelectedGameIds[0]}`
                            : `${editSelectedGameIds.length} experiences selected`}
                        </span>
                        <IconChevronDown size={16} className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-20 w-full mt-1 overflow-auto bg-white dark:bg-zinc-800 rounded-lg shadow-lg max-h-48 ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {games.map((game) => (
                          <Listbox.Option
                            key={game.id}
                            value={game.id}
                            className={({ active }) =>
                              `${active ? "bg-primary/10 text-primary" : "text-zinc-900 dark:text-white"} cursor-pointer select-none relative py-2.5 pl-10 pr-4 text-sm`
                            }
                          >
                            {({ selected }) => (
                              <>
                                <span className={`${selected ? "font-medium" : "font-normal"} block truncate`}>
                                  {game.name}
                                </span>
                                {selected && (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                                    <IconCheck size={16} aria-hidden="true" />
                                  </span>
                                )}
                              </>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Listbox>
                    {editSelectedGameIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {editSelectedGameIds.map((gid) => {
                          const game = games.find((g) => g.id === gid);
                          return (
                            <span
                              key={gid}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                            >
                              {game?.name ?? `Place ${gid}`}
                              <button
                                type="button"
                                onClick={() => setEditSelectedGameIds(editSelectedGameIds.filter((id) => id !== gid))}
                                className="hover:text-primary/60 transition-colors"
                                aria-label={`Remove ${game?.name ?? gid}`}
                              >
                                <IconX size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                    No games found for this workspace — place restriction is unavailable.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditCase}
                disabled={savingEdit || !editReason.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={savingEdit}
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

CaseDetailPage.layout = workspace;
export default CaseDetailPage;
