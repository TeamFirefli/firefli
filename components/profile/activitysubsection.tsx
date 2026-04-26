import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
import {
  IconChartBar,
  IconCalendarEvent,
  IconTarget,
} from "@tabler/icons-react";
import type { ActivitySession, Quota, inactivityNotice } from "@prisma/client";

type Props = {
  timeSpent: number;
  timesPlayed: number;
  data: any;
  quotas: (Quota & { currentValue?: number; percentage?: number })[];
  sessionsHosted: number;
  sessionsAttended: number;
  avatar: string;
  sessions: (ActivitySession & {
    user: {
      picture: string | null;
    };
  })[];
  notices: inactivityNotice[];
  adjustments?: any[];
  isHistorical?: boolean;
  historicalPeriod?: {
    start: string;
    end: string;
  } | null;
  loadingHistory?: boolean;
  messages?: number;
  idleTime?: number;
  selectedWeek?: number;
  availableHistory?: any[];
  getCurrentWeekLabel?: () => string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  goToPreviousWeek?: () => void;
  goToNextWeek?: () => void;
};

export function ActivityTabs(props: Props) {
  return (
    <div>
      <Tab.Group>
        <Tab.List className="flex border-b border-zinc-200 dark:border-zinc-700 mb-6 overflow-x-auto scrollbar-hide">
          <Tab
            className={({ selected }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 opacity-60 hover:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`
            }
          >
            <IconChartBar className="w-4 h-4" />
            Activity
          </Tab>
          <Tab
            className={({ selected }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 opacity-60 hover:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`
            }
          >
            <IconCalendarEvent className="w-4 h-4" />
            Sessions
          </Tab>
          <Tab
            className={({ selected }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 opacity-60 hover:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`
            }
          >
            <IconTarget className="w-4 h-4" />
            Quotas
          </Tab>
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel>
            <div className="text-zinc-600 dark:text-zinc-400">
              Activity Overview - Chart, metrics, and timeline will be here
            </div>
          </Tab.Panel>
          <Tab.Panel>
            <div className="text-zinc-600 dark:text-zinc-400">
              Sessions History - Basic metrics
            </div>
          </Tab.Panel>
          <Tab.Panel>
            <div className="text-zinc-600 dark:text-zinc-400">
              Quotas Progress - Quota cards and progress tracking
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
