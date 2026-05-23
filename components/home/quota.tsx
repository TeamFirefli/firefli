import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import clsx from "clsx";
import { IconTarget, IconCheck, IconChevronRight } from "@tabler/icons-react";

interface QuotaItem {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  value: number | null;
  currentValue: number | null;
  percentage: number;
  completed: boolean;
}

function formatType(type: string, value: number | null): string {
  switch (type) {
    case "mins": return `${value ?? "?"} min activity`;
    case "sessions_hosted": return `${value ?? "?"} sessions hosted`;
    case "sessions_secondary_host": return `${value ?? "?"} sessions co-hosted`;
    case "sessions_attended": return `${value ?? "?"} sessions attended`;
    case "sessions_logged": return `${value ?? "?"} sessions logged`;
    case "alliance_visits": return `${value ?? "?"} alliance visits`;
    case "recommendation_submissions": return `${value ?? "?"} recommendation submissions`;
    case "recommendation_votes": return `${value ?? "?"} recommendation votes`;
    case "custom": return "Custom requirement";
    default: return type;
  }
}

const Quota: React.FC = () => {
  const router = useRouter();
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!router.query.id) return;
    axios
      .get(`/api/workspace/${router.query.id}/home/quotas`)
      .then((res) => {
        if (res.data.success) setQuotas(res.data.quotas);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [router.query.id]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse h-14 bg-zinc-100 dark:bg-zinc-700 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
        Failed to load quotas
      </p>
    );
  }

  if (quotas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-[clamp(2rem,15cqh,4rem)] h-[clamp(2rem,15cqh,4rem)] rounded-full bg-primary/10 flex items-center justify-center mb-[clamp(0.5rem,4cqh,1rem)]">
          <IconTarget className="w-[clamp(1rem,8cqh,2rem)] h-[clamp(1rem,8cqh,2rem)] text-primary" />
        </div>
        <p className="text-[clamp(0.875rem,5cqh,1.125rem)] font-medium text-zinc-900 dark:text-white mb-1">No quotas assigned</p>
        <p className="text-[clamp(0.75rem,3.5cqh,0.875rem)] text-zinc-500 dark:text-zinc-400 mb-4">You have no quotas for this period</p>
      </div>
    );
  }

  const completed = quotas.filter((q) => q.completed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {completed}/{quotas.length} completed this period
        </p>
        <a
          href={`/workspace/${router.query.id}/quotas`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          All quotas <IconChevronRight className="w-3 h-3" />
        </a>
      </div>
      <div className="space-y-3">
        {quotas.map((quota) => {
          const pct = Math.min(100, Math.round(quota.percentage));
          return (
            <div
              key={quota.id}
              className="rounded-xl border border-zinc-100 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-900/50"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {quota.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatType(quota.type, quota.value)}
                  </p>
                </div>
                {quota.completed ? (
                  <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                    <IconCheck className="w-3 h-3" />
                    Done
                  </span>
                ) : (
                  <span className="flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {quota.type === "custom"
                      ? "Pending"
                      : `${quota.currentValue ?? 0}/${quota.value ?? "?"}`}
                  </span>
                )}
              </div>
              {quota.type !== "custom" && (
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-500",
                      quota.completed
                        ? "bg-green-500"
                        : pct >= 75
                        ? "bg-primary"
                        : pct >= 40
                        ? "bg-amber-500"
                        : "bg-zinc-400 dark:bg-zinc-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Quota;
