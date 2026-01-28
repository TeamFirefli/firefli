import useSWR from 'swr';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

type DashboardDataOptions = {
  widgets?: string[];
  includeBirthdays?: boolean;
  includeNewMembers?: boolean;
  fallbackData?: any;
};

export function useDashboardData(options: DashboardDataOptions = {}) {
  const router = useRouter();
  const workspaceId = router.query.id as string;

  const url = useMemo(() => {
    if (!workspaceId) return null;

    const params = new URLSearchParams();
    if (options.widgets?.length) {
      params.set('widgets', options.widgets.join(','));
    }
    if (options.includeBirthdays) {
      params.set('includeBirthdays', 'true');
    }
    if (options.includeNewMembers) {
      params.set('includeNewMembers', 'true');
    }

    return `/api/workspace/${workspaceId}/dashboard?${params.toString()}`;
  }, [workspaceId, options.widgets, options.includeBirthdays, options.includeNewMembers]);

  const { data, error, isLoading, mutate } = useSWR(
    url,
    {
      fallbackData: options.fallbackData,
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnMount: !options.fallbackData,
    }
  );

  return {
    data: data?.message,
    isLoading,
    isError: error,
    refresh: mutate
  };
}
