import React, { useState, useEffect, useRef } from "react";
import { FC } from "@/types/settingsComponent";
import { useRecoilState } from "recoil";
import { workspacestate, loginState } from "@/state";
import {
  IconPencil,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconStar,
  IconShieldCheck,
  IconDoorExit,
  IconClipboardList,
  IconRocket,
  IconTrash,
  IconChevronDown,
} from "@tabler/icons-react";
import axios from "axios";
import { useRouter } from "next/router";
import { toast } from "react-hot-toast";
import moment from "moment";

interface Props {
  userBook: any[];
  onRefetch?: () => void;
  logbookPermissions?: {
    view: boolean;
    rank: boolean;
    note: boolean;
    warning: boolean;
    promotion: boolean;
    demotion: boolean;
    termination: boolean;
    resignation: boolean;
    redact: boolean;
  };
}

const Book: FC<Props> = ({ userBook, onRefetch, logbookPermissions }) => {
  const router = useRouter();
  const { id } = router.query;
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [login] = useRecoilState(loginState);
  const [text, setText] = useState("");
  const [type, setType] = useState("note");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rankGunEnabled, setRankGunEnabled] = useState(false);
  const [targetRank, setTargetRank] = useState("");
  const [ranks, setRanks] = useState<
    Array<{ id: number; name: string; rank: number }>
  >([]);
  const [loadingRanks, setLoadingRanks] = useState(false);
  const [localBook, setLocalBook] = useState<any[]>(userBook || []);
  const [notifyDiscord, setNotifyDiscord] = useState(false);
  const [bloxlinkEnabled, setBloxlinkEnabled] = useState(false);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [kickFromDiscord, setKickFromDiscord] = useState(false);
  const [banFromDiscord, setBanFromDiscord] = useState(false);
  const [banDeleteDays, setBanDeleteDays] = useState(0);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const TYPE_LABELS: Record<string, string> = {
    note: "Note",
    warning: "Warning",
    promotion: "Promotion",
    demotion: "Demotion",
    rank_change: "Rank Change",
    termination: "Termination",
    resignation: "Resignation",
  };

  const availableTypes = [
    logbookPermissions?.note && { value: "note", label: "Note" },
    logbookPermissions?.warning && { value: "warning", label: "Warning" },
    logbookPermissions?.promotion && { value: "promotion", label: "Promotion" },
    logbookPermissions?.demotion && { value: "demotion", label: "Demotion" },
    (rankGunEnabled && logbookPermissions?.rank) && { value: "rank_change", label: "Rank Change" },
    logbookPermissions?.termination && { value: "termination", label: "Termination" },
    logbookPermissions?.resignation && { value: "resignation", label: "Resignation" },
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  useEffect(() => {
    setLocalBook(userBook || []);
  }, [userBook]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const checkRankGunStatus = async () => {
      try {
        const response = await axios.get(
          `/api/workspace/${id}/external/ranking`
        );
        setRankGunEnabled(response.data.rankGunEnabled);
        return response.data.rankGunEnabled;
      } catch (error) {
        return false;
      }
    };

    const fetchRanks = async () => {
      setLoadingRanks(true);
      try {
        const response = await axios.get(`/api/workspace/${id}/ranks`);
        if (response.data.success) {
          setRanks(response.data.ranks);
        }
      } catch (error) {
        console.error("Error fetching ranks:", error);
      } finally {
        setLoadingRanks(false);
      }
    };

    const checkDmCapability = async () => {
      try {
        const response = await axios.get(
          `/api/workspace/${id}/settings/bloxlink/enabled`
        );
        if (response.data.success) {
          setBloxlinkEnabled(response.data.bloxlinkActive ?? false);
          setDiscordEnabled(response.data.discordActive ?? false);
        }
      } catch (error) {
        // avail
      }
    };

    if (id) {
      checkRankGunStatus().then((enabled) => {
        if (enabled) {
          fetchRanks();
        }
      });
      checkDmCapability();
    }
  }, [id]);

  useEffect(() => {
    if (type !== "rank_change") {
      setTargetRank("");
    }
  }, [type]);

  const addNote = async () => {
    if (!text) {
      toast.error("Please enter a note.");
      return;
    }

    if (type === "rank_change" && !targetRank) {
      toast.error("Please select a target rank.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        notes: text,
        type: type,
        notifyDiscord: bloxlinkEnabled && discordEnabled && notifyDiscord,
        terminationAction: type === 'termination' && kickFromDiscord ? 'kick' : type === 'termination' && banFromDiscord ? 'ban' : 'none',
        banDeleteDays: banDeleteDays,
      };

      if (type === "rank_change") {
        const selectedRank = ranks.find(
          (rank) => rank.id.toString() === targetRank
        );
        if (selectedRank) {
          payload.targetRole = selectedRank.id;
        } else {
          toast.error("Invalid rank selected.");
          setIsSubmitting(false);
          return;
        }
      }

      const response = await axios.post(
        `/api/workspace/${id}/userbook/${router.query.uid}/new`,
        payload
      );

      setText("");
      setTargetRank("");

      if (response.data.terminated) {
        toast.success("User terminated successfully!");
      } else {
        const isRankGunAction =
          rankGunEnabled &&
          (type === "promotion" ||
            type === "demotion" ||
            type === "rank_change");
        toast.success(
          isRankGunAction
            ? "Note added and rank updated successfully!"
            : "Note added successfully"
        );
      }

      if (response.data.log) {
        setLocalBook((prev) => [response.data.log, ...prev]);
      }
      if (onRefetch) onRefetch();
    } catch (error: any) {
      console.error("Error adding note:", error);
      // log server response body for debugging
      try {
        console.error("Server response:", error?.response?.data);
      } catch (e) {}
      const raw = error?.response?.data?.error || error?.message || "Failed to add note";
      const errorMessage = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "note":
        return (
          <IconClipboardList className="w-5 h-5 text-zinc-500 dark:text-white" />
        );
      case "warning":
        return <IconAlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "promotion":
        return <IconStar className="w-5 h-5 text-green-500" />;
      case "demotion":
        return <IconX className="w-5 h-5 text-red-500" />;
      case "rank_change":
        return <IconRocket className="w-5 h-5 text-blue-500" />;
      case "termination":
        return <IconX className="w-5 h-5 text-red-500" />;
      case "resignation":
        return <IconDoorExit className="w-5 h-5 text-primary" />;
      default:
        return (
          <IconClipboardList className="w-5 h-5 text-zinc-500 dark:text-white" />
        );
    }
  };

  const getEntryTitle = (type: string) => {
    switch (type) {
      case "note":
        return "Note";
      case "warning":
        return "Warning";
      case "promotion":
        return "Promotion";
      case "demotion":
        return "Demotion";
      case "rank_change":
        return "Rank Change";
      case "termination":
        return "Termination";
      case "resignation":
        return "Resignation";
      default:
        return "Note";
    }
  };

  const canRedact = (workspace: any) => {
    return (workspace?.yourPermission || []).includes("manage_members");
  };

  const isOwner = () => {
    try {
      // Check if the current user is the workspace owner by comparing ownerId from workspaces array
      if (!login?.userId || !login?.workspaces) return false;
      const currentWorkspace = login.workspaces.find((ws: any) => ws.groupId === workspace.groupId);
      return currentWorkspace?.ownerId === login.userId;
    } catch (e) {
      return false;
    }
  };

  const redactEntry = async (entry: any) => {
    setRedactTarget(entry);
    setShowRedactModal(true);
  };

  const deleteEntry = async (entry: any) => {
    setDeleteTarget(entry);
    setShowDeleteModal(true);
  };

  const [showRedactModal, setShowRedactModal] = React.useState(false);
  const [redactTarget, setRedactTarget] = React.useState<any | null>(null);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<any | null>(null);

  const confirmRedact = async () => {
    if (!redactTarget) return;
    try {
      const response = await axios.post(
        `/api/workspace/${id}/userbook/${router.query.uid}/${redactTarget.id}/redact`,
        { redacted: !redactTarget.redacted }
      );
      if (response.data.success) {
        toast.success(
          response.data.entry?.redacted ? "Entry redacted!" : "Entry unredacted!"
        );
        const updatedEntry = response.data.entry;
        setLocalBook((prev) =>
          prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
        );
        if (onRefetch) onRefetch();
      }
    } catch (error: any) {
      toast.error("Failed to redact entry.");
    } finally {
      setShowRedactModal(false);
      setRedactTarget(null);
    }
  };

  const confirmDeleteEntry = async () => {
    if (!deleteTarget) return;
    try {
      const response = await axios.delete(
        `/api/workspace/${id}/userbook/${router.query.uid}/${deleteTarget.id}/delete`
      );
      if (response.data.success) {
        toast.success("Entry deleted!");
        setLocalBook((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        if (onRefetch) onRefetch();
      }
    } catch (error: any) {
      toast.error("Failed to delete entry.");
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const getRankChangeText = (entry: any) => {
    if (
      (entry.type === "promotion" ||
        entry.type === "demotion" ||
        entry.type === "rank_change" ||
        entry.type === "termination" ||
        entry.type === "resignation") &&
      entry.rankBefore !== null &&
      entry.rankAfter !== null
    ) {
      const beforeText = entry.rankNameBefore
        ? `${entry.rankNameBefore} (${entry.rankBefore})`
        : `Rank ${entry.rankBefore}`;
      const afterText = entry.rankNameAfter
        ? `${entry.rankNameAfter} (${entry.rankAfter})`
        : `Rank ${entry.rankAfter}`;
      return `${beforeText} → ${afterText}`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
              <IconClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
                Add Entry
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Log performance, rank changes, warnings, and other important updates.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <textarea
              id="note"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your comment.."
              className="block w-full px-4 py-3 bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-700"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-xl">
              <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
                {rankGunEnabled && logbookPermissions?.rank && (type === "promotion" || type === "demotion" || type === "rank_change" || type === "termination") && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Rank to:</span>
                    {loadingRanks ? (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <div className="animate-spin w-3 h-3 border border-zinc-300 border-t-primary rounded-full" />
                        Loading...
                      </div>
                    ) : (
                      <select
                        value={targetRank}
                        onChange={(e) => setTargetRank(e.target.value)}
                        className="text-xs px-2.5 py-1.5 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                      >
                        <option value="">Select rank...</option>
                        {ranks.filter((rank) => rank.rank > 0).map((rank) => {
                          const duplicates = ranks.filter(r => r.rank > 0 && r.name === rank.name && r.rank === rank.rank);
                          const displayText = duplicates.length > 1
                            ? `${rank.name} (${rank.rank}, ID: ${rank.id})`
                            : `${rank.name} (${rank.rank})`;
                          return <option key={rank.id} value={rank.id}>{displayText}</option>;
                        })}
                      </select>
                    )}
                  </div>
                )}

                {bloxlinkEnabled && discordEnabled && (type === "warning" || type === "promotion" || type === "demotion" || type === "termination" || type === "resignation") && (
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap select-none">
                    <input
                      type="checkbox"
                      checked={notifyDiscord}
                      onChange={(e) => setNotifyDiscord(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-primary border-zinc-300 dark:border-zinc-600 focus:ring-primary"
                    />
                    <span className="text-zinc-600 dark:text-zinc-400">Notify via Discord</span>
                  </label>
                )}
                {type === "termination" && notifyDiscord && bloxlinkEnabled && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap select-none">
                      <input
                        type="checkbox"
                        checked={kickFromDiscord}
                        onChange={(e) => { setKickFromDiscord(e.target.checked); if (e.target.checked) setBanFromDiscord(false); }}
                        className="w-3.5 h-3.5 rounded text-red-600 border-zinc-300 focus:ring-red-500"
                      />
                      <span className="text-zinc-500 dark:text-zinc-400">Kick from server</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap select-none">
                      <input
                        type="checkbox"
                        checked={banFromDiscord}
                        onChange={(e) => { setBanFromDiscord(e.target.checked); if (e.target.checked) setKickFromDiscord(false); }}
                        className="w-3.5 h-3.5 rounded text-red-600 border-zinc-300 focus:ring-red-500"
                      />
                      <span className="text-zinc-500 dark:text-zinc-400">Ban from server</span>
                    </label>
                    {banFromDiscord && (
                      <select
                        value={banDeleteDays}
                        onChange={(e) => setBanDeleteDays(parseInt(e.target.value))}
                        className="text-xs px-2 py-1 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded text-zinc-700 dark:text-zinc-300"
                      >
                        <option value={0}>Keep messages</option>
                        <option value={1}>Delete 1 day</option>
                        <option value={2}>Delete 2 days</option>
                        <option value={3}>Delete 3 days</option>
                        <option value={7}>Delete 7 days</option>
                      </select>
                    )}
                  </>
                )}
              </div>

              <div className="relative flex-shrink-0" ref={typeDropdownRef}>
                <div className="flex rounded-lg overflow-hidden shadow-sm">
                  <button
                    onClick={addNote}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {rankGunEnabled && logbookPermissions?.rank && (type === "promotion" || type === "demotion" || type === "rank_change" || type === "termination") ? "Executing..." : "Logging..."}
                      </>
                    ) : rankGunEnabled && logbookPermissions?.rank && (type === "promotion" || type === "demotion" || type === "rank_change" || type === "termination") ? (
                      `Log & ${type === "rank_change" ? "Change Rank" : type === "promotion" ? "Promote" : type === "demotion" ? "Demote" : "Terminate"}`
                    ) : (
                      `Log ${TYPE_LABELS[type] || "Note"}`
                    )}
                  </button>
                  {availableTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTypeDropdownOpen((o) => !o)}
                      disabled={isSubmitting}
                      className="px-2 py-2 text-white bg-primary hover:bg-primary/80 border-l border-white/20 focus:outline-none transition-colors disabled:opacity-50"
                      aria-label="Change entry type"
                    >
                      <IconChevronDown size={16} />
                    </button>
                  )}
                </div>
                {typeDropdownOpen && availableTypes.length > 1 && (
                  <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-20 overflow-hidden">
                    {availableTypes.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { setType(t.value); setTypeDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          type === t.value
                            ? "text-primary font-medium bg-primary/5"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {logbookPermissions?.view && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
              <IconClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
                History
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                A timeline of all notes, rank changes, and terminations for this member.
              </p>
            </div>
          </div>

          {localBook.length === 0 ? (
            <div className="text-center py-12">
              <div className="rounded-xl p-8 max-w-md mx-auto">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <IconClipboardList className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
                  No Notes
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  No notes have been added to this user's book yet
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {localBook.map((entry: any) => {
                const rankChangeText = getRankChangeText(entry);
                return (
                  <div
                    key={entry.id}
                    className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg"
                  >
                    <div className="flex-shrink-0">{getIcon(entry.type)}</div>
                    <div className="flex-grow min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              entry.redacted
                                ? "line-through opacity-60 text-zinc-500 dark:text-zinc-300"
                                : "text-zinc-900 dark:text-white"
                            }`}
                          >
                            {getEntryTitle(entry.type)}
                          </span>
                          {rankChangeText && (
                            <span className="text-xs dark:bg-blue-100 bg-blue-900 dark:text-blue-800 text-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {rankChangeText}
                            </span>
                          )}
                        </div>
                        <time className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {moment(entry.createdAt).format("DD MMM YYYY")}
                        </time>
                      </div>
                      <p
                        className={`text-sm ${
                          entry.redacted
                            ? "line-through opacity-60 text-zinc-500 dark:text-zinc-300 mb-1"
                            : "text-zinc-600 dark:text-zinc-300 mb-1"
                        }`}
                      >
                        {entry.reason}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Logged by {entry.admin?.username || "Unknown"}
                      </p>

                      {entry.redacted && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-300 mt-2">
                          Redacted by{" "}
                          {entry.redactedByUser?.username ||
                            (entry.redactedBy
                              ? entry.redactedBy.toString()
                              : "Unknown")}{" "}
                          on{" "}
                          {entry.redactedAt
                            ? moment(entry.redactedAt).format("DD MMM YYYY")
                            : "Unknown"}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end justify-start gap-2">
                      {logbookPermissions?.redact && (
                        <button
                          onClick={() => redactEntry(entry)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-zinc-700 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200 transition-colors"
                        >
                          <IconAlertTriangle className="w-4 h-4 mr-2" />
                          {entry.redacted ? "Undo" : "Redact"}
                        </button>
                      )}
                      {isOwner() && (
                        <button
                          onClick={() => deleteEntry(entry)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
                        >
                          <IconTrash className="w-4 h-4 mr-2" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
      {showRedactModal && redactTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              {redactTarget.redacted ? "Undo Redaction" : "Redact Entry"}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              {redactTarget.redacted
                ? "Un-redacting will make the entry visible again."
                : "Mark this entry as redacted? This will cross it out for viewers."}
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowRedactModal(false);
                  setRedactTarget(null);
                }}
                className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmRedact}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                {redactTarget.redacted ? "Undo" : "Redact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Confirm Deletion
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to permanently delete this entry?</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteEntry}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Book;