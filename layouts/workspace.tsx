/* eslint-disable react-hooks/rules-of-hooks */
import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import BottomBar from "@/components/bottombar";
import type { LayoutProps } from "@/layoutTypes";
import axios from "axios";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import { loginState } from "@/state";
import { useRouter } from "next/router";

import WorkspaceBirthdayPrompt from '@/components/bdayprompt';
import NewFeatures from '@/components/newfeats';
import { useEffect, useState, useMemo, useCallback } from "react";
import clsx from 'clsx';
import SecondarySidebar, { SecondarySidebarSection, SecondarySidebarItem } from "@/components/tabs";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Home07Icon,
  HourglassIcon,
  Target01Icon,
  ChampionIcon,
  Calendar01Icon,
  UserMultiple02Icon,
  UserGroupIcon,
  Beach02Icon,
  File02Icon,
  UserShield01Icon,
  Flag01Icon,
  Key01Icon,
  LockIcon,
  Alert02Icon,
  ServerStack01Icon,
  DiscordIcon,
  Contact01Icon,
} from "@hugeicons/core-free-icons";
import {
  IconTrophy,
  IconCalendarStats,
  IconUsers,
  IconBeach,
  IconFilter,
  IconFileText,
  IconShield,
  IconHome,
  IconHourglassHigh,
  IconFlag,
  IconKey,
  IconLock,
  IconBellExclamation,
  IconServer,
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
  IconCoffee,
  IconSchool,
} from "@tabler/icons-react";

const SAVED_VIEW_ICONS: { [key: string]: any } = {
  star: IconStar,
  sparkles: IconSparkles,
  briefcase: IconBriefcase,
  target: IconTarget,
  alert: IconAlertTriangle,
  calendar: IconCalendarWeekFilled,
  speakerphone: IconSpeakerphone,
  file: IconFile,
  folder: IconFolder,
  box: IconBox,
  id: IconId,
  tools: IconTools,
  tag: IconTag,
  pin: IconPin,
  bell: IconBell,
  lock: IconLock,
  coffee: IconCoffee,
  school: IconSchool,
};

const createDarkIcon = (IconComponent: any) => {
  return (props: any) => (
    <IconComponent 
      {...props} 
      style={{ stroke: '#18181b', color: '#18181b', fill: 'none' }} 
    />
  );
};

const DARK_SAVED_VIEW_ICONS: { [key: string]: any } = {
  star: createDarkIcon(IconStar),
  sparkles: createDarkIcon(IconSparkles),
  briefcase: createDarkIcon(IconBriefcase),
  target: createDarkIcon(IconTarget),
  alert: createDarkIcon(IconAlertTriangle),
  calendar: createDarkIcon(IconCalendarWeekFilled),
  speakerphone: createDarkIcon(IconSpeakerphone),
  file: createDarkIcon(IconFile),
  folder: createDarkIcon(IconFolder),
  box: createDarkIcon(IconBox),
  id: createDarkIcon(IconId),
  tools: createDarkIcon(IconTools),
  tag: createDarkIcon(IconTag),
  pin: createDarkIcon(IconPin),
  bell: createDarkIcon(IconBell),
  lock: createDarkIcon(IconLock),
  coffee: createDarkIcon(IconCoffee),
  school: createDarkIcon(IconSchool),
};


const workspace: LayoutProps = ({ children }) => {
	const [workspace, setWorkspace] = useRecoilState(workspacestate);
	const [login] = useRecoilState(loginState);
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [newFeatsDone, setNewFeatsDone] = useState(false);
	const [savedViews, setSavedViews] = useState<Array<{id: string; name: string; color?: string; icon?: string}>>([]);
	const [localViews, setLocalViews] = useState<Array<{id: string; name: string; color?: string; icon?: string}>>([]);
	const [savedViewsLoaded, setSavedViewsLoaded] = useState(false);
	const [pendingPolicyCount, setPendingPolicyCount] = useState(0);
	const [pendingNoticesCount, setPendingNoticesCount] = useState(0);
	const [apiKeyAlertType, setApiKeyAlertType] = useState<"none" | "missing" | "invalid">("none");

	const useTheme = (groupTheme: string) => {
		// Handle custom colors
		if (groupTheme && groupTheme.startsWith("custom-")) {
			const hex = groupTheme.replace("custom-", "");
			const r = parseInt(hex.substring(0, 2), 16);
			const g = parseInt(hex.substring(2, 4), 16);
			const b = parseInt(hex.substring(4, 6), 16);
			return `${r} ${g} ${b}`;
		}

		const themes: Record<string, string> = {
			"bg-pink-100": "#fce7f3",
			"bg-rose-100": "#ffe4e6",
			"bg-orange-100": "#ffedd5",
			"bg-amber-100": "#fef3c7",
			"bg-lime-100": "#ecfccb",
			"bg-emerald-100": "#d1fae5",
			"bg-cyan-100": "#cffafe",
			"bg-sky-100": "#e0f2fe",
			"bg-indigo-100": "#e0e7ff",
			"bg-purple-100": "#f3e8ff",
			"bg-pink-400": "#f472b6",
			"bg-rose-400": "#fb7185",
			"bg-orange-400": "#fb923c",
			"bg-amber-400": "#fbbf24",
			"bg-lime-400": "#a3e635",
			"bg-emerald-400": "#34d399",
			"bg-cyan-400": "#22d3ee",
			"bg-sky-400": "#38bdf8",
			"bg-indigo-400": "#818cf8",
			"bg-violet-400": "#a78bfa",
			"bg-firefli": "#9300df",
			"bg-rose-600": "#e11d48",
			"bg-orange-600": "#ea580c",
			"bg-amber-600": "#d97706",
			"bg-lime-600": "#65a30d",
			"bg-emerald-600": "#059669",
			"bg-cyan-600": "#0891b2",
			"bg-sky-600": "#0284c7",
			"bg-indigo-600": "#4f46e5",
			"bg-violet-600": "#7c3aed",
			"bg-blue-500": "#3b82f6",
			"bg-red-500": "#ef4444",
			"bg-red-700": "#b91c1c",
			"bg-green-500": "#22c55e",
			"bg-green-600": "#16a34a",
			"bg-yellow-500": "#eab308",
			"bg-orange-500": "#f97316",
			"bg-purple-500": "#a855f7",
			"bg-pink-500": "#ec4899",
			"bg-black": "#000000",
			"bg-zinc-500": "#6b7280",
		};
		const raw = themes[groupTheme] || "#9300df";
		const r = parseInt(raw.substring(1, 3), 16);
		const g = parseInt(raw.substring(3, 5), 16);
		const b = parseInt(raw.substring(5, 7), 16);
		return `${r} ${g} ${b}`;
	};

	const loadSavedViews = useCallback(async () => {
		if (!router.query.id) return;
		const hasUseSavedViewsPermission = workspace.isAdmin || workspace.yourPermission?.includes("use_views");
		if (!hasUseSavedViewsPermission) {
			setSavedViewsLoaded(true);
			return;
		}
		try {
			const res = await axios.get(`/api/workspace/${router.query.id}/views`);
			if (res.data) {
				setSavedViews(res.data.views || []);
				setLocalViews(res.data.localViews || []);
			}
		} catch (e) {
			console.error("Failed to load views", e);
		}
		setSavedViewsLoaded(true);
	}, [router.query.id, workspace.isAdmin, workspace.yourPermission]);

	const deleteSavedView = useCallback(async (viewId: string) => {
		try {
			await axios.delete(`/api/workspace/${router.query.id}/views/${viewId}`);
			setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
			setLocalViews((prev) => prev.filter((v) => v.id !== viewId));
			window.dispatchEvent(new CustomEvent('savedViewsChanged'));
		} catch (e) {
			console.error("Failed to delete view", e);
		}
	}, [router.query.id]);

	const isStaffSection = useMemo(() => {
		const path = router.asPath;
		const id = router.query.id;
		if (!id) return false;
		const staffPages = ['/views', '/notices'];
		return staffPages.some(page => path.includes(`/workspace/${id}${page}`));
	}, [router.asPath, router.query.id]);

	useEffect(() => {
		if (isStaffSection && !savedViewsLoaded) {
			loadSavedViews();
		}
	}, [isStaffSection, savedViewsLoaded, loadSavedViews]);

	useEffect(() => {
		if (workspace.settings?.policiesEnabled && router.query.id) {
			fetch(`/api/workspace/${router.query.id}/policies/pending`)
				.then(res => res.json())
				.then(data => {
					if (data.success) {
						setPendingPolicyCount(data.count);
					}
				})
				.catch(() => setPendingPolicyCount(0));
		}
	}, [router.query.id, workspace.settings?.policiesEnabled]);

	useEffect(() => {
		if (router.query.id) {
			const canApprove = workspace.yourPermission?.includes("approve_notices") ||
				workspace.yourPermission?.includes("manage_notices") ||
				workspace.isAdmin;
			if (canApprove) {
				fetch(`/api/workspace/${router.query.id}/activity/notices/count`)
					.then(res => res.json())
					.then(data => {
						if (data.success) {
							setPendingNoticesCount(data.count || 0);
						}
					})
					.catch(() => setPendingNoticesCount(0));
			}
		}
	}, [router.query.id, workspace.yourPermission, workspace.isAdmin]);

	useEffect(() => {
		const handleSavedViewsChanged = () => {
			loadSavedViews();
		};
		window.addEventListener('savedViewsChanged', handleSavedViewsChanged);
		return () => {
			window.removeEventListener('savedViewsChanged', handleSavedViewsChanged);
		};
	}, [loadSavedViews]);

	useEffect(() => {
		setSavedViewsLoaded(false);
	}, [router.query.id]);

	useEffect(() => {
		router.events.on("routeChangeStart", () => setLoading(true));
		router.events.on("routeChangeComplete", () => setLoading(false));
	}, [router.events]);

	useEffect(() => {
		async function getworkspace() {
			try {
				const res = await axios.get("/api/workspace/" + router.query.id);
				setWorkspace(res.data.workspace);
			} catch (e: any) {
				router.push("/");
			}
		}
		if (router.query.id) getworkspace();
	}, [router.query.id, setWorkspace, router]);

	useEffect(() => {
		if (workspace && workspace.groupTheme) {
			const theme = useTheme(workspace.groupTheme);
			document.documentElement.style.setProperty("--group-theme", theme);
		}
	}, [workspace]);

	// Check if workspace owner has Open Cloud API key configured
	useEffect(() => {
		if (!workspace?.groupId || !login?.userId) return;
		// Only show to the workspace owner or admins
		const isOwner = workspace.ownerId && Number(login.userId) === Number(workspace.ownerId);
		const isAdmin = workspace.isAdmin;
		if (!isOwner && !isAdmin) {
			setApiKeyAlertType("none");
			return;
		}
		const checkApiKey = async () => {
			try {
				const res = await axios.get(`/api/workspace/${workspace.groupId}/settings/external?validate=true`);
				const hasKey = !!res.data?.robloxApiKey && res.data.robloxApiKey !== "";
				const keyValid = res.data?.robloxApiKeyValid;
				if (!hasKey) {
					setApiKeyAlertType("missing");
				} else if (keyValid === false) {
					setApiKeyAlertType("invalid");
				} else {
					setApiKeyAlertType("none");
				}
			} catch {
				setApiKeyAlertType("none");
			}
		};
		checkApiKey();
	}, [workspace?.groupId, workspace?.ownerId, workspace?.isAdmin, login?.userId]);

	const getSecondarySidebar = useMemo(() => {
		const path = router.asPath;
		const id = router.query.id;
		if (!id) return null;
		const activityPages = ['/activity', '/leaderboard', '/quotas'];
		const isActivitySection = activityPages.some(page => 
			path.includes(`/workspace/${id}${page}`)
		);

		if (isActivitySection) {
			const activityItems: SecondarySidebarItem[] = [
				{
					label: "Activity",
					href: `/workspace/${id}/activity`,
					icon: HourglassIcon,
					active: path.includes(`/workspace/${id}/activity`),
				},
				{
					label: "Quotas",
					href: `/workspace/${id}/quotas`,
					icon: Target01Icon,
					active: path.includes(`/workspace/${id}/quotas`),
				},
			];

			activityItems.push({
				label: "Leaderboard",
				href: `/workspace/${id}/leaderboard`,
				icon: ChampionIcon,
				active: path.includes(`/workspace/${id}/leaderboard`),
			});

			const sections: SecondarySidebarSection[] = [
				{
					title: "Activity",
					items: activityItems,
				},
			];
			return { title: "Activity", sections, hideHeader: true };
		}

		const staffPages = ['/views', '/directory', '/notices', '/recommendations'];
		const isStaffSectionPage = staffPages.some(page => 
			path.includes(`/workspace/${id}${page}`)
		);

		if (isStaffSectionPage) {
			const currentViewId = router.query.view as string;
			const isOnNotices = path.includes(`/workspace/${id}/notices`);
			const teamViewItems: SecondarySidebarItem[] = savedViews.map((view) => ({
				id: view.id,
				label: view.name,
				href: currentViewId === view.id 
					? `/workspace/${id}/views` 
					: `/workspace/${id}/views?view=${view.id}`,
				color: view.color || undefined,
				icon: view.icon && DARK_SAVED_VIEW_ICONS[view.icon] ? DARK_SAVED_VIEW_ICONS[view.icon] : undefined,
				active: currentViewId === view.id,
				canDelete: true,
				onDelete: deleteSavedView,
			}));

			const localViewItems: SecondarySidebarItem[] = localViews.map((view) => ({
				id: view.id,
				label: view.name,
				href: currentViewId === view.id 
					? `/workspace/${id}/views` 
					: `/workspace/${id}/views?view=${view.id}`,
				color: view.color || undefined,
				icon: view.icon && DARK_SAVED_VIEW_ICONS[view.icon] ? DARK_SAVED_VIEW_ICONS[view.icon] : undefined,
				active: currentViewId === view.id,
				canDelete: true,
				onDelete: deleteSavedView,
			}));

			const hasViewMembersPermission = workspace.yourPermission?.includes("view_members");
			const hasViewDirectoryPermission = workspace.yourPermission?.includes("view_directory");
			const hasNoticesPermission = 
				workspace.yourPermission?.includes("create_notices") ||
				workspace.yourPermission?.includes("approve_notices") ||
				workspace.yourPermission?.includes("manage_notices");
			const hasUseSavedViewsPermission = workspace.isAdmin || workspace.yourPermission?.includes("use_views");
			const hasCreateViewsPermission = workspace.isAdmin || workspace.yourPermission?.includes("create_views");
			const hasEditViewsPermission = workspace.isAdmin || workspace.yourPermission?.includes("edit_views");
			const handleReorderTeamViews = async (reorderedItems: any[]) => {
				const reorderedViews = reorderedItems
					.map(item => savedViews.find(v => v.id === item.id))
					.filter((v): v is typeof savedViews[0] => v !== undefined);
				const viewIds = reorderedViews.map(v => v.id);
				setSavedViews(reorderedViews);
				try {
					await axios.post(`/api/workspace/${id}/views/reorder`, { viewIds });
				} catch (error) {
					console.error("Failed to reorder views:", error);
					loadSavedViews();
				}
			};

			const handleReorderLocalViews = async (reorderedItems: any[]) => {
				const reorderedViews = reorderedItems
					.map(item => localViews.find(v => v.id === item.id))
					.filter((v): v is typeof localViews[0] => v !== undefined);
				
				const viewIds = reorderedViews.map(v => v.id);
				setLocalViews(reorderedViews);
				try {
					await axios.post(`/api/workspace/${id}/views/reorder`, { viewIds });
				} catch (error) {
					console.error("Failed to reorder views:", error);
					loadSavedViews();
				}
			};

			const staffItems: SecondarySidebarItem[] = [];
			
			const isOnRecommendationsPage = path.includes(`/workspace/${id}/recommendations`);
			const isOnDirectoryPage = path.includes(`/workspace/${id}/directory`);
			if (hasViewMembersPermission) {
				staffItems.push({
					label: "Views",
					href: `/workspace/${id}/views`,
					icon: UserMultiple02Icon,
					active: !isOnNotices && !isOnRecommendationsPage && !isOnDirectoryPage && !currentViewId,
				});
			}

			if (hasViewDirectoryPermission) {
				staffItems.push({
					label: "Directory",
					href: `/workspace/${id}/directory`,
					icon: Contact01Icon,
					active: isOnDirectoryPage,
				});
			}
			
			if (hasNoticesPermission) {
				staffItems.push({
					label: "Notices",
					href: `/workspace/${id}/notices`,
					icon: Beach02Icon,
					active: isOnNotices,
					badge: pendingNoticesCount > 0 ? pendingNoticesCount : undefined,
				});
			}

			const hasRecommendationsPermission = workspace.settings?.recommendationsEnabled && (workspace.yourPermission?.includes("view_recommendations") || workspace.isAdmin);
			if (hasRecommendationsPermission) {
				staffItems.push({
					label: "Recommendations",
					href: `/workspace/${id}/recommendations`,
					icon: IconSparkles,
					active: isOnRecommendationsPage,
				});
			}

			const sections: SecondarySidebarSection[] = [
				{
					title: "Staff",
					items: staffItems,
				},
			];
			if (hasUseSavedViewsPermission) {
				sections.push({
					title: "Team Views",
					icon: UserGroupIcon,
					canAdd: hasCreateViewsPermission,
					onAdd: hasCreateViewsPermission ? () => {
					router.push(`/workspace/${id}/views?newView=team`);
					} : undefined,
					items: teamViewItems,
					draggable: hasEditViewsPermission,
					onReorder: hasEditViewsPermission ? handleReorderTeamViews : undefined,
				});
			}
			sections.push({
				title: "Local Views",
				icon: UserMultiple02Icon,
				canAdd: true,
				onAdd: () => {
					router.push(`/workspace/${id}/views?newView=local`);
				},
				items: localViewItems,
				draggable: true,
				onReorder: handleReorderLocalViews,
			});
			return { title: "Staff", sections, hideHeader: true };
		}

		const policiesEnabled = workspace.settings?.policiesEnabled;
		const resourcesPages = ['/docs', '/policies'];
		const isResourcesSection = resourcesPages.some(page => 
			path.includes(`/workspace/${id}${page}`)
		);

		if (isResourcesSection && policiesEnabled) {
			const sections: SecondarySidebarSection[] = [
				{
					title: "Resources",
					items: [
						{
							label: "Docs",
							href: `/workspace/${id}/docs`,
							icon: File02Icon,
						},
						{
							label: "Policies",
							href: `/workspace/${id}/policies`,
							icon: UserShield01Icon,
							badge: pendingPolicyCount > 0 ? pendingPolicyCount : undefined,
						},
					],
				},
			];
			return { title: "Resources", sections, hideHeader: true };
		}

		const isSettingsSection = path.includes(`/workspace/${id}/settings`);

		if (isSettingsSection) {
			const hasPermission = (permission: string) => {
				return workspace.isAdmin || workspace.yourPermission?.includes(permission);
			};

			const canAccessGeneral = hasPermission('workspace_customisation');
			const canAccessActivity = hasPermission('reset_activity');
			const canAccessSessions = hasPermission('manage_features');
			const canAccessFeatures = hasPermission('manage_features');
			const canAccessApi = hasPermission('manage_apikeys');
			const canAccessPermissions = workspace.isAdmin || hasPermission('admin');
			const canAccessAudit = hasPermission('view_audit_logs');
			const canAccessIntegrations = workspace.isAdmin || hasPermission('admin');
			const canAccessInstance = workspace.isAdmin || hasPermission('admin');
			const currentSection = (router.query.section as string) || 'general';
			const settingsItems: SecondarySidebarItem[] = [];

			if (canAccessGeneral) {
				settingsItems.push({
					label: "General",
					href: `/workspace/${id}/settings?section=general`,
					icon: Home07Icon,
					active: currentSection === 'general',
				});
			}
			if (canAccessActivity) {
				settingsItems.push({
					label: "Activity",
					href: `/workspace/${id}/settings?section=activity`,
					icon: HourglassIcon,
					active: currentSection === 'activity',
				});
			}
			if (canAccessSessions) {
				settingsItems.push({
					label: "Sessions",
					href: `/workspace/${id}/settings?section=sessions`,
					icon: Calendar01Icon,
					active: currentSection === 'sessions',
				});
			}
			if (canAccessFeatures) {
				settingsItems.push({
					label: "Feature Flags",
					href: `/workspace/${id}/settings?section=features`,
					icon: Flag01Icon,
					active: currentSection === 'features',
				});
			}
			if (canAccessApi) {
				settingsItems.push({
					label: "Public API",
					href: `/workspace/${id}/settings?section=api`,
					icon: Key01Icon,
					active: currentSection === 'api',
				});
			}
			if (canAccessPermissions) {
				settingsItems.push({
					label: "Permissions",
					href: `/workspace/${id}/settings?section=permissions`,
					icon: LockIcon,
					active: currentSection === 'permissions',
				});
			}
			if (canAccessAudit) {
				settingsItems.push({
					label: "Audit Logs",
					href: `/workspace/${id}/settings?section=audit`,
					icon: Alert02Icon,
					active: currentSection === 'audit',
				});
			}
			if (canAccessIntegrations) {
				settingsItems.push({
					label: "Discord",
					href: `/workspace/${id}/settings?section=integrations`,
					icon: DiscordIcon,
					active: currentSection === 'integrations',
				});
			}
			if (canAccessInstance) {
				settingsItems.push({
					label: "Services",
					href: `/workspace/${id}/settings?section=instance`,
					icon: ServerStack01Icon,
					active: currentSection === 'instance',
				});
			}

			const sections: SecondarySidebarSection[] = [
				{
					title: "Settings",
					items: settingsItems,
				},
			];
			return { title: "Settings", sections, hideHeader: true };
		}

		return null;
	}, [router.asPath, router.query.id, router.query.section, savedViews, localViews, router, workspace.isAdmin, workspace.yourPermission, workspace.settings?.guidesEnabled, workspace.settings?.policiesEnabled, workspace.settings?.sessionsEnabled, workspace.settings?.recommendationsEnabled, deleteSavedView, pendingPolicyCount, pendingNoticesCount]);

	const showSecondarySidebar = !!getSecondarySidebar;
	const workspaceBg = workspace && workspace.groupTheme ? "" : "bg-firefli";
	return (
		<div className={clsx("h-screen-safe overflow-hidden bg-white/80 dark:bg-zinc-800/80", workspaceBg)}> 
		<Head>
			<title>{workspace.groupName ? `Firefli - ${workspace.groupName}` : "Loading..."}</title>
			<link rel="icon" href={`${workspace.groupThumbnail}`} />
			</Head>

			<div className="flex flex-col h-screen-safe overflow-hidden">
				<Topbar />
				<div className="flex flex-1 min-h-0">
					<Sidebar />
					{getSecondarySidebar ? (
						<div className="hidden md:flex">
							<SecondarySidebar
								title={getSecondarySidebar.title}
								sections={getSecondarySidebar.sections}
								hideHeader={getSecondarySidebar.hideHeader}
							/>
						</div>
					) : (
						<div className="hidden md:flex w-4 h-full bg-zinc-50 dark:bg-zinc-900 rounded-tl-2xl flex-shrink-0 backdrop-blur-sm" />
					)}
					<main
						id="main-content-scroll"
						className={clsx(
						"flex-1 transition-all duration-300 overflow-y-auto",
						"pb-20 md:pb-0",
						"bg-zinc-50 dark:bg-zinc-900"
						)}>
						{apiKeyAlertType !== "none" && (
							<div className="mx-4 mt-4 mb-0 flex items-center gap-3 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 px-4 py-3">
								<IconAlertTriangle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
								<div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
									{apiKeyAlertType === "missing" ? (
										<><strong>Roblox Open Cloud API key not configured.</strong>{" "}
										Group member syncing and ranking actions require an API key to function.</>
									) : (
										<><strong>Roblox Open Cloud API key is invalid or expired.</strong>{" "}
										Group member syncing and ranking actions will not work until the key is updated.</>
									)}
								</div>
								<button
									onClick={() => router.push(`/workspace/${workspace.groupId}/settings?section=instance`)}
									className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
								>
									{apiKeyAlertType === "missing" ? "Configure Now" : "Update Key"}
								</button>
								<button
									onClick={() => setApiKeyAlertType("none")}
									className="flex-shrink-0 p-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
									title="Dismiss"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</button>
							</div>
						)}
						{children}
						{newFeatsDone && router.query.id && (
							<WorkspaceBirthdayPrompt workspaceId={router.query.id as string} />
						)}
						<NewFeatures onReady={() => setNewFeatsDone(true)} />
					</main>
				</div>
				<BottomBar />
			</div>
		</div>
	);
};

export default workspace;
