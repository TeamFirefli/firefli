import React, { useState, useRef } from "react";
import type { Quota } from "@prisma/client";
import { IconChartBar, IconUsers, IconBriefcase, IconCheck } from "@tabler/icons-react";
import Tooltip from "@/components/tooltip";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

type QuotaWithLinkage = Quota & {
  currentValue?: number;
  percentage?: number;
  linkedVia?: 'role' | 'department';
  linkedName?: string;
  linkedColor?: string | null;
  completed?: boolean;
  completedAt?: Date | null;
  completedByUser?: { username: string } | null;
  completionType?: string | null;
};

type Props = {
  quotas: QuotaWithLinkage[];
  displayMinutes: number;
  sessionsHosted: number;
  sessionsSecondaryHosted: number;
  sessionsAttended: number;
  allianceVisits: number;
  canSignoffQuotas?: boolean;
  targetUserId?: string;
  isViewingOwnProfile?: boolean;
  workspaceId?: string;
  isHistorical?: boolean;
  periodEnd?: string;
};

export function QuotasProgress({
  quotas,
  displayMinutes,
  sessionsHosted,
  sessionsSecondaryHosted,
  sessionsAttended,
  allianceVisits,
  canSignoffQuotas = false,
  targetUserId,
  isViewingOwnProfile = false,
  workspaceId,
  isHistorical = false,
  periodEnd,
}: Props) {
  const [localQuotas, setLocalQuotas] = useState(quotas);
  const quotaSetKey = `${isHistorical ? 'h' : 'c'}:${periodEnd ?? ''}:${quotas.map(q => (q as any).id).join(',')}`;
  const prevQuotaSetKey = useRef('');
  React.useEffect(() => {
    if (quotaSetKey !== prevQuotaSetKey.current) {
      prevQuotaSetKey.current = quotaSetKey;
      setLocalQuotas(quotas);
    }
  }, [quotaSetKey]);
  const getQuotaPercentage = (quota: Quota | any) => {
    if (!quota || !quota.value) {
      return 0;
    }
    if (isHistorical && quota.type !== "custom" && quota.currentValue !== undefined) {
      return (quota.currentValue / quota.value) * 100;
    }
    if (quota.type !== "custom" && quota.percentage !== undefined) {
      return quota.percentage;
    }
    switch (quota.type) {
      case "mins": {
        return (displayMinutes / quota.value) * 100;
      }
      case "sessions_hosted": {
        return (sessionsHosted / quota.value) * 100;
      }
      case "sessions_secondary_host": {
        return quota.currentValue !== undefined
          ? (quota.currentValue / quota.value) * 100
          : (sessionsSecondaryHosted / quota.value) * 100;
      }
      case "sessions_attended": {
        return (sessionsAttended / quota.value) * 100;
      }
      case "sessions_logged": {
        const totalLogged = sessionsHosted + sessionsAttended;
        return (totalLogged / quota.value) * 100;
      }
      case "alliance_visits": {
        return (allianceVisits / quota.value) * 100;
      }
      default: {
        return 0;
      }
    }
  };

  const getQuotaProgress = (quota: Quota | any) => {
    if (!quota || !quota.type) {
      return "0 / 0";
    }
    if (quota.currentValue !== undefined) {
      return `${quota.currentValue} / ${quota.value} ${
        quota.type === "mins"
          ? "minutes"
          : quota.type === "alliance_visits"
          ? "visits"
          : quota.type.replace("_", " ")
      }`;
    }
    switch (quota.type) {
      case "mins": {
        return `${displayMinutes} / ${quota.value} minutes`;
      }
      case "sessions_hosted": {
        return `${sessionsHosted} / ${quota.value} sessions hosted (primary)`;
      }
      case "sessions_secondary_host": {
        const val = quota.currentValue !== undefined ? quota.currentValue : sessionsSecondaryHosted;
        return `${val} / ${quota.value} sessions hosted (secondary)`;
      }
      case "sessions_attended": {
        return `${sessionsAttended} / ${quota.value} sessions attended`;
      }
      case "sessions_logged": {
        const totalLogged = sessionsHosted + sessionsAttended;
        return `${totalLogged} / ${quota.value} sessions logged`;
      }
      case "alliance_visits": {
        return `${allianceVisits} / ${quota.value} alliance visits`;
      }
      default: {
        return `${quota.currentValue || 0} / ${quota.value || 0}`;
      }
    }
  };

  if (localQuotas.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="rounded-xl p-8 max-w-md mx-auto">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <IconChartBar className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
            No Quotas
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            No activity quotas have been assigned yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-6 border-b border-zinc-200 dark:border-zinc-700">
        <div className="p-2 bg-primary/10 rounded-lg">
          <IconChartBar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold dark:text-white text-zinc-900">
            Activity Quotas
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Track how this member is progressing against their targets
          </p>
        </div>
      </div>
      <div className="p-4 md:p-6">
        <Toaster position="bottom-center" />
        <div className="grid gap-4">
          {localQuotas.map((quota: QuotaWithLinkage) => (
            <div
              key={quota.id}
              className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-sm font-medium dark:text-white text-zinc-900">
                  {quota.name}
                </h3>
              </div>
              {quota.sessionType && quota.sessionType !== 'all' && (
                <p className="text-xs text-primary mb-1">
                  Session type: {quota.sessionType.charAt(0).toUpperCase() + quota.sessionType.slice(1)}
                </p>
              )}
              {quota.linkedVia && quota.linkedName && (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span
                    className="inline-flex items-center gap-1 text-white py-1 px-2 rounded-full text-xs font-medium"
                    style={{ backgroundColor: quota.linkedColor || "#6b7280" }}
                  >
                    {quota.linkedVia === 'role' ? (
                      <IconUsers className="w-3 h-3" />
                    ) : (
                      <IconBriefcase className="w-3 h-3" />
                    )}
                    {quota.linkedName}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Progress
                </span>
                {quota.type !== "custom" ? (
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">
                    {getQuotaProgress(quota)}
                  </span>
                ) : quota.completed ? (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <IconCheck className="w-4 h-4" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                    Not completed
                  </span>
                )}
              </div>
              
              {quota.type !== "custom" && (
                <>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-600 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        (getQuotaPercentage(quota) || 0) >= 100
                          ? "bg-green-500"
                          : "bg-primary"
                      }`}
                      style={{
                        width: `${Math.min(getQuotaPercentage(quota) || 0, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {(getQuotaPercentage(quota) || 0).toFixed(0)}% complete
                  </p>
                </>
              )}
              
              {quota.type === "custom" && quota.completed && (
                <div className="mt-2 space-y-2">
                  {quota.completedAt && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Completed on {new Date(quota.completedAt).toLocaleDateString()}
                    </p>
                  )}
                  {quota.completedByUser && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Signed off by @{quota.completedByUser.username}
                    </p>
                  )}
                  {!isHistorical && workspaceId && targetUserId && (
                    (quota.completionType === "user_complete" && isViewingOwnProfile) ||
                    (quota.completionType === "manager_signoff" && canSignoffQuotas) ||
                    (quota.completionType === "user_complete" && canSignoffQuotas && !isViewingOwnProfile)
                  ) && (
                    <button
                      onClick={() => {
                        const promise = axios.post(
                          `/api/workspace/${workspaceId}/activity/quotas/${quota.id}/uncomplete`,
                          { targetUserId }
                        ).then(() => {
                          setLocalQuotas(prev => prev.map((q: any) => 
                            q.id === quota.id 
                              ? { ...q, completed: false, completedAt: null, completedBy: null, completedByUser: null, completionNotes: null }
                              : q
                          ));
                        });
                        toast.promise(promise, {
                          loading: "Marking as incomplete...",
                          success: "Quota marked as incomplete!",
                          error: "Failed to mark as incomplete"
                        });
                      }}
                      className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors"
                    >
                      Mark as incomplete
                    </button>
                  )}
                </div>
              )}
              
              {quota.type === "custom" && !quota.completed && (
                <div className="mt-2">
                  {workspaceId && targetUserId ? (
                    <>
                      {quota.completionType === "user_complete" && isViewingOwnProfile && !isHistorical ? (
                        <button
                          onClick={() => {
                            const promise = axios.post(
                              `/api/workspace/${workspaceId}/activity/quotas/${quota.id}/complete`,
                              { targetUserId }
                            ).then(() => {
                              setLocalQuotas(prev => prev.map((q: any) => 
                                q.id === quota.id 
                                  ? { ...q, completed: true, completedAt: new Date(), percentage: 100 }
                                  : q
                              ));
                            });
                            toast.promise(promise, {
                              loading: "Marking as complete...",
                              success: "Quota completed!",
                              error: "Failed to complete quota"
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          <IconCheck className="w-3.5 h-3.5" />
                          Mark as Complete
                        </button>
                      ) : (canSignoffQuotas && (
                        quota.completionType === "manager_signoff" ||
                        (quota.completionType === "user_complete" && (!isViewingOwnProfile || isHistorical)) ||
                        (isHistorical && !quota.completionType)
                      )) ? (
                        <button
                          onClick={() => {
                            const promise = axios.post(
                              `/api/workspace/${workspaceId}/activity/quotas/${quota.id}/signoff`,
                              { targetUserId, ...(isHistorical && periodEnd ? { periodEnd } : {}) }
                            ).then(() => {
                              setLocalQuotas(prev => prev.map((q: any) => 
                                q.id === quota.id 
                                  ? { ...q, completed: true, completedAt: new Date(), percentage: 100 }
                                  : q
                              ));
                            });
                            toast.promise(promise, {
                              loading: "Signing off quota...",
                              success: "Quota signed off!",
                              error: "Failed to sign off quota"
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          <IconCheck className="w-3.5 h-3.5" />
                          {quota.completionType === "user_complete" ? "Mark as Complete" : "Sign Off"}
                        </button>
                      ) : !isHistorical ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                          {quota.completionType === "user_complete" 
                            ? "Can be self-completed on user's own profile" 
                            : canSignoffQuotas 
                              ? "Requires manager signoff" 
                              : "Requires manager with signoff permission"}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
