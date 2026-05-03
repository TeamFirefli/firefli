import { useState, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { workspacestate } from '@/state';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Notification01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons';
import useSWR from 'swr';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const fetcher = (url: string) => axios.get(url).then((r) => r.data);

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hours ago`;
  return `${Math.floor(h / 24)} days ago`;
}

function icon(type: string) {
  if (type.startsWith('notice_')) return 'bg-blue-500';
  if (type.startsWith('userbook_warning') || type.startsWith('userbook_termination')) return 'bg-red-500';
  if (type.startsWith('userbook_promotion')) return 'bg-green-500';
  if (type.startsWith('userbook_demotion')) return 'bg-orange-500';
  if (type.startsWith('session_')) return 'bg-purple-500';
  return 'bg-zinc-400';
}

type Props = {
  variant?: 'topbar' | 'bottombar';
};

export default function Notifications({ variant = 'topbar' }: Props) {
  const [workspace] = useRecoilState(workspacestate);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data, mutate } = useSWR<{ notifications: Notification[]; unreadCount: number }>(
    workspace.groupId ? `/api/workspace/${workspace.groupId}/notifications` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    const refresh = () => mutate();
    router.events.on('routeChangeComplete', refresh);
    return () => router.events.off('routeChangeComplete', refresh);
  }, [mutate, router.events]);

  useEffect(() => {
    if (variant !== 'topbar') return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, variant]);

  async function markAllRead() {
    await axios.patch(`/api/workspace/${workspace.groupId}/notifications`);
    mutate();
  }

  async function dismissNotif(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await axios.delete(`/api/workspace/${workspace.groupId}/notifications`, { data: { ids: [id] } });
    mutate();
  }

  async function clearAll() {
    await axios.delete(`/api/workspace/${workspace.groupId}/notifications`);
    mutate();
  }

  async function onClick(n: Notification) {
    if (!n.read) {
      await axios.patch(`/api/workspace/${workspace.groupId}/notifications`, { ids: [n.id] });
      mutate();
    }
    if (n.href) {
      setOpen(false);
      router.push(n.href);
    }
  }

  const bellButton = (
    <button
      onClick={() => setOpen((v) => !v)}
      className={`relative transition-colors ${variant === 'bottombar' ? 'flex flex-col items-center justify-center flex-1 py-2 hover:opacity-80' : 'p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
      aria-label="Notifications"
    >
      <HugeiconsIcon
        icon={Notification01Icon}
        strokeWidth={1.5}
        className={variant === 'bottombar' ? 'w-6 h-6 text-zinc-500 dark:text-zinc-400' : 'w-5 h-5 text-zinc-600 dark:text-zinc-300'}
      />
      {variant === 'bottombar' && (
        <span className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">Alerts</span>
      )}
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  const notificationList = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications</span>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline px-2 py-1 rounded"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:underline px-2 py-1 rounded transition-colors"
            >
              Clear all
            </button>
          )}
          {variant === 'bottombar' && (
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.5} className="w-4 h-4 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1 max-h-[360px]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400 dark:text-zinc-500">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={1.5} className="w-8 h-8 mb-2" />
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`group relative flex items-start gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-700/50 last:border-0 ${
                !n.read ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
              }`}
            >
              <button
                onClick={() => onClick(n)}
                className="flex items-start gap-3 flex-1 min-w-0 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors rounded -mx-1 px-1"
              >
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${icon(n.type)} ${n.read ? 'opacity-40' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-zinc-900 dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </button>
              <button
                onClick={(e) => dismissNotif(e, n.id)}
                className="flex-shrink-0 mt-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                aria-label="Dismiss"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.5} className="w-3.5 h-3.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (variant === 'topbar') {
    return (
      <div className="relative" ref={panelRef}>
        {bellButton}
        <Transition
          show={open}
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-[100]">
            {notificationList}
          </div>
        </Transition>
      </div>
    );
  }

  return (
    <>
      {bellButton}
      <Transition show={open} as={Fragment}>
        <div className="fixed inset-0 z-[200]">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
            <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white dark:bg-zinc-800 shadow-xl safe-area-bottom">
              {notificationList}
            </div>
          </Transition.Child>
        </div>
      </Transition>
    </>
  );
}
