import { useState, useEffect } from "react"
import type { NextPage } from "next"
import { loginState, workspacestate } from "@/state"
import { themeState } from "@/state/theme"
import { useRecoilState } from "recoil"
import { Menu, Listbox, Dialog, Transition } from "@headlessui/react"
import { useRouter } from "next/router"
import ThemeToggle from "./ThemeToggle";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { 
  Home07Icon,
  Comment01Icon,
  Task01Icon,
  File02Icon,
  UserMultipleIcon,
  UserIcon,
  Agreement01Icon,
  Settings01Icon,
  Sun03Icon,
  Moon02Icon,
  Beach02Icon,
  UserShield01Icon
} from "@hugeicons/core-free-icons"
import {
  IconStar,
  IconSparkles,
  IconBriefcase,
  IconTarget,
  IconAlertTriangle,
  IconCalendarWeekFilled,
  IconSpeakerphone,
  IconFile,
  IconFolder,
  IconBox,
  IconId,
  IconTools,
  IconTag,
  IconPin,
  IconBell,
  IconLock,
  IconCoffee,
  IconSchool,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import { Fragment } from "react"
import axios from "axios"
import clsx from "clsx"
import Parser from "rss-parser"
import ReactMarkdown from "react-markdown";
import packageJson from "../package.json";

const ChangelogContent: React.FC<{ workspaceId: number }> = ({ workspaceId }) => {
  const [entries, setEntries] = useState<
    { title: string; pubDate: string; content: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/changelog')
      .then(res => res.json())
      .then(data => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!entries.length) return <p className="text-sm text-zinc-500">No entries found.</p>;

  return (
    <div className="space-y-6">
      {entries.map((entry, idx) => (
        <div 
          key={idx}
          className={clsx(
            "pb-6",
            idx < entries.length - 1 && "border-b border-zinc-200 dark:border-zinc-700"
          )}
        >
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {entry.title}
          </a>
          <div className="text-xs text-zinc-400 mt-1 mb-3">{entry.pubDate}</div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:my-2">
            <ReactMarkdown>{entry.content}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
};

const Sidebar: NextPage = () => {
  const [login, setLogin] = useRecoilState(loginState)
  const [workspace, setWorkspace] = useRecoilState(workspacestate)
  const [theme, setTheme] = useRecoilState(themeState)
  const [showCopyright, setShowCopyright] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelog, setChangelog] = useState<{ title: string, pubDate: string, content: string }[]>([]);
  const [docsEnabled, setDocsEnabled] = useState(false);
  const [alliesEnabled, setAlliesEnabled] = useState(false);
  const [sessionsEnabled, setSessionsEnabled] = useState(false);
  const [noticesEnabled, setNoticesEnabled] = useState(false);
  const [policiesEnabled, setPoliciesEnabled] = useState(false);
  const [pendingPolicyCount, setPendingPolicyCount] = useState(0);
  const [pendingNoticesCount, setPendingNoticesCount] = useState(0);
  const router = useRouter()

  const ICON_OPTIONS: { key: string; Icon: any }[] = [
    { key: "star", Icon: IconStar },
    { key: "sparkles", Icon: IconSparkles },
    { key: "briefcase", Icon: IconBriefcase },
    { key: "target", Icon: IconTarget },
    { key: "alert", Icon: IconAlertTriangle },
    { key: "calendar", Icon: IconCalendarWeekFilled },
    { key: "speakerphone", Icon: IconSpeakerphone },
    { key: "file", Icon: IconFile },
    { key: "folder", Icon: IconFolder },
    { key: "box", Icon: IconBox },
    { key: "id", Icon: IconId },
    { key: "tools", Icon: IconTools },
    { key: "tag", Icon: IconTag },
    { key: "pin", Icon: IconPin },
    { key: "bell", Icon: IconBell },
    { key: "lock", Icon: IconLock },
    { key: "coffee", Icon: IconCoffee },
    { key: "school", Icon: IconSchool },
  ];

  const renderIcon = (key: string, className = "w-4 h-4") => {
    const found = ICON_OPTIONS.find((i) => i.key === key);
    if (!found) return null;
    const C = found.Icon;
    return <C className={className} />;
  };

  // Define section categories with their sub-pages
  type SectionConfig = {
    name: string;
    icon: IconSvgElement | React.ElementType;
    accessible?: boolean;
    href?: string;
    matchPaths?: string[];
  };

  const getSections = (): SectionConfig[] => {
    if (!workspace?.groupId) return [];
    
    return [
    { 
      name: "Home", 
      href: `/workspace/${workspace.groupId}`, 
      icon: Home07Icon,
    },
    { 
      name: "Wall", 
      href: `/workspace/${workspace.groupId}/wall`, 
      icon: Comment01Icon,
      accessible: workspace.yourPermission?.includes("view_wall") 
    },
    { 
      name: "Activity", 
      href: `/workspace/${workspace.groupId}/activity`,
      icon: Task01Icon,
      accessible: true,
      matchPaths: [
        `/workspace/${workspace.groupId}/activity`,
        `/workspace/${workspace.groupId}/leaderboard`,
        `/workspace/${workspace.groupId}/sessions`,
      ]
    },
    ...((docsEnabled || policiesEnabled) ? [{ 
      name: "Docs", 
      href: docsEnabled ? `/workspace/${workspace.groupId}/docs` : `/workspace/${workspace.groupId}/policies`, 
      icon: File02Icon,
      accessible: true,
      matchPaths: [
        `/workspace/${workspace.groupId}/docs`,
        `/workspace/${workspace.groupId}/policies`,
      ]
    }] : []),
    { 
      name: "Staff", 
      href: `/workspace/${workspace.groupId}/views`,
      icon: UserIcon, 
      accessible: workspace.yourPermission?.includes("view_members"),
      matchPaths: [
        `/workspace/${workspace.groupId}/views`,
        `/workspace/${workspace.groupId}/notices`,
      ]
    },
    ...(alliesEnabled ? [{
      name: "Alliances",
      href: `/workspace/${workspace.groupId}/alliances`,
      icon: Agreement01Icon,
      accessible: true,
    }] : []),
  ];
  };

  const sections = getSections();

  // Keep pages array for backward compatibility
  const pages: {
    name: string
    href: string
    icon: IconSvgElement | React.ElementType
    accessible?: boolean
  }[] = [
    { name: "Home", href: `/workspace/${workspace.groupId}`, icon: Home07Icon },
    { name: "Wall", href: `/workspace/${workspace.groupId}/wall`, icon: Comment01Icon, accessible: workspace.yourPermission.includes("view_wall") },
    { name: "Activity", href: `/workspace/${workspace.groupId}/activity`, icon: Task01Icon, accessible: true },
   ...(noticesEnabled ? [{
      name: "Notices",
      href: `/workspace/${workspace.groupId}/notices`,
      icon: Beach02Icon,
      accessible: true,
    }] : []),
    ...(alliesEnabled ? [{
      name: "Alliances",
      href: `/workspace/${workspace.groupId}/alliances`,
      icon: Agreement01Icon,
      accessible: true,
    }] : []),
    ...(sessionsEnabled ? [{
      name: "Sessions",
      href: `/workspace/${workspace.groupId}/sessions`,
      icon: IconCalendarWeekFilled,
      accessible: true,
    }] : []),
    { name: "Staff", href: `/workspace/${workspace.groupId}/views`, icon: UserMultipleIcon, accessible: workspace.yourPermission.includes("view_members") },
    ...(docsEnabled ? [{ name: "Docs", href: `/workspace/${workspace.groupId}/docs`, icon: File02Icon, accessible: true }] : []),
    ...(policiesEnabled ? [{ name: "Policies", href: `/workspace/${workspace.groupId}/policies`, icon: UserShield01Icon, accessible: true }] : []),
  ];

  const settingsAccessible = ["admin", "workspace_customisation", "reset_activity", "manage_features", "manage_apikeys", "view_audit_logs"].some(perm => workspace.yourPermission.includes(perm));
  const settingsHref = `/workspace/${workspace.groupId}/settings`;
  const isSettingsActive = router.asPath === settingsHref || router.asPath.startsWith(`${settingsHref}/`);

  const gotopage = (page: string) => {
    router.push(page)
  }

  const logout = async () => {
    await axios.post("/api/auth/logout")
    setLogin({
      userId: 1,
      username: "",
      displayname: "",
      canMakeWorkspace: false,
      thumbnail: "",
      workspaces: [],
      isOwner: false,
    })
    router.push("/login")
  }

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme)
    }
  }

  useEffect(() => {
    if (showChangelog && changelog.length === 0) {
      fetch('/api/changelog')
        .then(res => res.json())
        .then(items => setChangelog(items));
    }
  }, [showChangelog, changelog.length]);

  useEffect(() => {
    fetch(`/api/workspace/${workspace.groupId}/settings/general/configuration`)
      .then(res => res.json())
      .then(data => {
        setDocsEnabled(data.value.guides?.enabled ?? false);
		setAlliesEnabled(data.value.allies?.enabled ?? false);
		setSessionsEnabled(data.value.sessions?.enabled ?? false);
		setNoticesEnabled(data.value.notices?.enabled ?? false);
		setPoliciesEnabled(data.value.policies?.enabled ?? false);
      })
      .catch(() => setDocsEnabled(false));
  }, [workspace.groupId]);

  useEffect(() => {
    if (policiesEnabled) {
      fetch(`/api/workspace/${workspace.groupId}/policies/pending`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setPendingPolicyCount(data.count);
          }
        })
        .catch(() => setPendingPolicyCount(0));
    }
  }, [workspace.groupId, policiesEnabled]);

  useEffect(() => {
    if (noticesEnabled) {
      if (workspace.yourPermission?.includes("approve_notices") || workspace.yourPermission?.includes("manage_notices") || workspace.yourPermission?.includes("admin")) {
        fetch(`/api/workspace/${workspace.groupId}/activity/notices/count`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setPendingNoticesCount(data.count || 0);
            }
          })
          .catch(() => setPendingNoticesCount(0));
      }
    }
  }, [workspace.groupId, noticesEnabled, workspace.yourPermission]);

  return (
    <div className="hidden md:flex h-full flex-row">
      <aside
        className={clsx(
          "h-full flex flex-col pointer-events-auto shadow-xl transition-all duration-300",
          "bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm",
          "w-16 min-w-[4rem]",
        )}
      >
        <div className="h-full flex flex-col p-2 overflow-y-auto pb-3">
          <nav className="flex-1 space-y-1 flex flex-col items-center">
            {sections.map((section) => {
              if (section.accessible === undefined || section.accessible) {
                const isActive = section.matchPaths 
                  ? section.matchPaths.some(path => router.asPath.startsWith(path))
                  : (section.href && router.asPath === section.href.replace("[id]", workspace.groupId.toString()));
                const isHugeIcon = Array.isArray(section.icon);
                return (
                  <button
                    key={section.name}
                    onClick={() => {
                      if (section.href) {
                        gotopage(section.href);
                      }
                    }}
                    title={section.name}
                    className={clsx(
                      "rounded-lg transition-all duration-300 relative flex items-center justify-center w-12 h-12",
                      isActive
                        ? "bg-[color:rgb(var(--group-theme)/0.1)] text-[color:rgb(var(--group-theme))]"
                        : "text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700",
                    )}
                  >
                    {isHugeIcon ? (
                      <HugeiconsIcon icon={section.icon as IconSvgElement} className="w-5 h-5" strokeWidth={1.5} />
                    ) : (
                      (() => { const IconComponent = section.icon as React.ElementType; return <IconComponent className="w-5 h-5" />; })()
                    )}
                    {section.name === "Docs" && pendingPolicyCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {pendingPolicyCount > 9 ? '9+' : pendingPolicyCount}
                      </span>
                    )}
                    {section.name === "Staff" && pendingNoticesCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {pendingNoticesCount > 9 ? '9+' : pendingNoticesCount}
                      </span>
                    )}
                  </button>
                );
              }
              return null;
            })}
          </nav>
          <div className="flex justify-center">
            <div className="rounded-lg transition-all duration-300 flex items-center justify-center w-12 h-12 hover:bg-zinc-100 dark:hover:bg-zinc-700">
              <ThemeToggle />
            </div>
          </div>
          {settingsAccessible && (
            <div className="flex justify-center">
              <button
                onClick={() => {
                  gotopage(settingsHref);
                }}
                title="Settings"
                className={clsx(
                  "rounded-lg transition-all duration-300 flex items-center justify-center w-12 h-12",
                  isSettingsActive
                    ? "bg-[color:rgb(var(--group-theme)/0.1)] text-[color:rgb(var(--group-theme))]"
                    : "text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700",
                )}
              >
                <HugeiconsIcon icon={Settings01Icon} className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Dialogs */}
      <Dialog
        open={showCopyright}
        onClose={() => setShowCopyright(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-sm rounded-lg bg-white dark:bg-zinc-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-medium text-zinc-900 dark:text-white">
                Copyright Notices
              </Dialog.Title>
              <button
                onClick={() => setShowCopyright(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <IconX className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            <div className="space-y-4">

              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  Firefli features, enhancements, and modifications:
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Copyright © 2026 Firefli. All rights reserved.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  Orbit features, enhancements, and modifications:
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Copyright © 2025 Planetary. All rights reserved.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  Original Tovy features and code:
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Copyright © 2022 Tovy. All rights reserved.
                </p>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <Dialog
        open={showChangelog}
        onClose={() => setShowChangelog(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-lg rounded-lg bg-white dark:bg-zinc-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-medium text-zinc-900 dark:text-white">
                Changelog
              </Dialog.Title>
              <button
                onClick={() => setShowChangelog(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700">
                <IconX className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            <div className="space-y-6 max-h-96 overflow-y-auto">
              {changelog.length === 0 && <p className="text-sm text-zinc-500">Loading...</p>}
              {changelog.map((entry, idx) => (
                <div 
                  key={idx}
                  className={clsx(
                    "pb-6",
                    idx < changelog.length - 1 && "border-b border-zinc-200 dark:border-zinc-700"
                  )}
                >
                  <a target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                    {entry.title}
                  </a>
                  <div className="text-xs text-zinc-400 mt-1 mb-3">{entry.pubDate}</div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:my-2">
                    <ReactMarkdown>{entry.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  )
}

export default Sidebar
