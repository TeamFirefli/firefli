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
import { useRouter } from "next/router";
import hexRgb from "hex-rgb";
import * as colors from "tailwindcss/colors";
import WorkspaceBirthdayPrompt from '@/components/bdayprompt';
import { useEffect, useState, useMemo, useCallback } from "react";
import clsx from 'clsx';
import SecondarySidebar, { SecondarySidebarSection, SecondarySidebarItem } from "@/components/tabs";
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Home07Icon,
  HourglassIcon,
  Target01Icon,
  ChampionIcon,
  Calendar01Icon,
  UserMultiple02Icon,
  Beach02Icon,
  File02Icon,
  UserShield01Icon,
  Flag01Icon,
  Key01Icon,
  LockIcon,
  Alert02Icon,
  ServerStack01Icon,
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


const workspace: LayoutProps = ({ children }) => {
	const [workspace, setWorkspace] = useRecoilState(workspacestate);
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [savedViews, setSavedViews] = useState<Array<{id: string; name: string; color?: string; icon?: string}>>([]);
	const [savedViewsLoaded, setSavedViewsLoaded] = useState(false);

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
			"bg-pink-100": colors.pink[100],
			"bg-rose-100": colors.rose[100],
			"bg-orange-100": colors.orange[100],
			"bg-amber-100": colors.amber[100],
			"bg-lime-100": colors.lime[100],
			"bg-emerald-100": colors.emerald[100],
			"bg-cyan-100": colors.cyan[100],
			"bg-sky-100": colors.sky[100],
			"bg-indigo-100": colors.indigo[100],
			"bg-purple-100": colors.purple[100],
			"bg-pink-400": colors.pink[400],
			"bg-rose-400": colors.rose[400],
			"bg-orange-400": colors.orange[400],
			"bg-amber-400": colors.amber[400],
			"bg-lime-400": colors.lime[400],
			"bg-emerald-400": colors.emerald[400],
			"bg-cyan-400": colors.cyan[400],
			"bg-sky-400": colors.sky[400],
			"bg-indigo-400": colors.indigo[400],
			"bg-violet-400": colors.violet[400],
			"bg-firefli": "#3498db",
			"bg-rose-600": colors.rose[600],
			"bg-orange-600": colors.orange[600],
			"bg-amber-600": colors.amber[600],
			"bg-lime-600": colors.lime[600],
			"bg-emerald-600": colors.emerald[600],
			"bg-cyan-600": colors.cyan[600],
			"bg-sky-600": colors.sky[600],
			"bg-indigo-600": colors.indigo[600],
			"bg-violet-600": colors.violet[600],
			"bg-blue-500": colors.blue[500],
			"bg-red-500": colors.red[500],
			"bg-red-700": colors.red[700],
			"bg-green-500": colors.green[500],
			"bg-green-600": colors.green[600],
			"bg-yellow-500": colors.yellow[500],
			"bg-orange-500": colors.orange[500],
			"bg-purple-500": colors.purple[500],
			"bg-pink-500": colors.pink[500],
			"bg-black": colors.black,
			"bg-zinc-500": colors.gray[500],
		};
		const hex = hexRgb(themes[groupTheme] || "#FF0099");
		return `${hex.red} ${hex.green} ${hex.blue}`;
	};

	const loadSavedViews = useCallback(async () => {
		if (!router.query.id) return;
		try {
			const res = await axios.get(`/api/workspace/${router.query.id}/views`);
			if (res.data && res.data.views) {
				setSavedViews(res.data.views || []);
			}
		} catch (e) {
			console.error("Failed to load saved views", e);
		}
		setSavedViewsLoaded(true);
	}, [router.query.id]);

	const deleteSavedView = useCallback(async (viewId: string) => {
		try {
			await axios.delete(`/api/workspace/${router.query.id}/views/${viewId}`);
			setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
			window.dispatchEvent(new CustomEvent('savedViewsChanged'));
		} catch (e) {
			console.error("Failed to delete saved view", e);
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

	const getSecondarySidebar = useMemo(() => {
		const path = router.asPath;
		const id = router.query.id;
		if (!id) return null;
		const activityPages = ['/activity', '/leaderboard', '/sessions', '/quotas'];
		const isActivitySection = activityPages.some(page => 
			path.includes(`/workspace/${id}${page}`)
		);

		if (isActivitySection) {
			const leaderboardEnabled = workspace.settings?.leaderboardEnabled;
			const sessionsEnabled = workspace.settings?.sessionsEnabled;
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

			if (leaderboardEnabled) {
				activityItems.push({
					label: "Leaderboard",
					href: `/workspace/${id}/leaderboard`,
					icon: ChampionIcon,
					active: path.includes(`/workspace/${id}/leaderboard`),
				});
			}

			if (sessionsEnabled) {
				activityItems.push({
					label: "Sessions",
					href: `/workspace/${id}/sessions`,
					icon: Calendar01Icon,
					active: path.includes(`/workspace/${id}/sessions`),
				});
			}

			const sections: SecondarySidebarSection[] = [
				{
					title: "Activity",
					items: activityItems,
				},
			];
			return { title: "Activity", sections, hideHeader: true };
		}

		const staffPages = ['/views', '/notices'];
		const isStaffSectionPage = staffPages.some(page => 
			path.includes(`/workspace/${id}${page}`)
		);

		if (isStaffSectionPage) {
			const currentViewId = router.query.view as string;
			const isOnNotices = path.includes(`/workspace/${id}/notices`);
			const savedViewItems: SecondarySidebarItem[] = savedViews.map((view) => ({
				id: view.id,
				label: view.name,
				href: currentViewId === view.id 
					? `/workspace/${id}/views` 
					: `/workspace/${id}/views?view=${view.id}`,
				color: view.color || undefined,
				icon: view.icon && SAVED_VIEW_ICONS[view.icon] ? SAVED_VIEW_ICONS[view.icon] : undefined,
				active: currentViewId === view.id,
				canDelete: true,
				onDelete: deleteSavedView,
			}));

			const sections: SecondarySidebarSection[] = [
				{
					title: "Staff",
					items: [
						{
							label: "Views",
							href: `/workspace/${id}/views`,
							icon: UserMultiple02Icon,
							active: !isOnNotices && !currentViewId,
						},
						{
							label: "Notices",
							href: `/workspace/${id}/notices`,
							icon: Beach02Icon,
							active: isOnNotices,
						},
					],
				},
				{
					title: "Saved Views",
					canAdd: true,
					onAdd: () => {
						router.push(`/workspace/${id}/views?newView=true`);
					},
					items: savedViewItems,
				},
			];
			return { title: "Staff", sections, hideHeader: true };
		}

		const docsEnabled = workspace.settings?.guidesEnabled;
		const policiesEnabled = workspace.settings?.policiesEnabled;
		const bothResourcesEnabled = docsEnabled && policiesEnabled;
		const resourcesPages = ['/docs', '/policies'];
		const isResourcesSection = resourcesPages.some(page => 
			path.includes(`/workspace/${id}${page}`)
		);

		if (isResourcesSection && bothResourcesEnabled) {
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
			const canAccessFeatures = hasPermission('manage_features');
			const canAccessApi = hasPermission('manage_apikeys');
			const canAccessPermissions = workspace.isAdmin || hasPermission('admin');
			const canAccessAudit = hasPermission('view_audit_logs');
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
	}, [router.asPath, router.query.id, router.query.section, savedViews, router, workspace.isAdmin, workspace.yourPermission, workspace.settings?.guidesEnabled, workspace.settings?.policiesEnabled, workspace.settings?.leaderboardEnabled, workspace.settings?.sessionsEnabled, deleteSavedView]);

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
						<div className="hidden md:flex w-4 h-full bg-zinc-50 dark:bg-zinc-900 rounded-tl-2xl flex-shrink-0" />
					)}
					<main
						className={clsx(
						"flex-1 transition-all duration-300 overflow-y-auto",
						"pb-20 md:pb-0"
						)}>
						<AnimatePresence mode="wait">
							<motion.div
								key={router.asPath}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.2, ease: "easeInOut" }}
								className="relative z-10"
							>
								{children}
							</motion.div>
						</AnimatePresence>
						{router.query.id && (
							<WorkspaceBirthdayPrompt workspaceId={router.query.id as string} />
						)}
					</main>
				</div>
				<BottomBar />
			</div>
		</div>
	);
};

export default workspace;
