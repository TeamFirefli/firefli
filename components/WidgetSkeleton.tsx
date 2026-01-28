import React from 'react';

export const WidgetSkeleton: React.FC<{ height?: string }> = ({
  height = 'h-64'
}) => {
  return (
    <div className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-sm overflow-hidden border border-zinc-100 dark:border-zinc-700 ${height}`}>
      <div className="px-6 py-5 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900/20 dark:to-zinc-800/20 border-b border-zinc-100 dark:border-zinc-700 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="flex-1">
            <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-2"></div>
            <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 animate-pulse"></div>
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2 animate-pulse"></div>
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6 animate-pulse"></div>
      </div>
    </div>
  );
};
