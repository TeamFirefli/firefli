import { atom, selector } from "recoil";
import Router from "next/router";
import { role } from "@prisma/client";
import axios from "axios";
export type workspaceinfo = {
	groupId: number;
				groupThumbnail: string;
				groupName: string
				ownerId?: number | null;
}

export type LoginState = {
	userId: number;
	username: string;
	displayname: string;
	thumbnail: string;
	canMakeWorkspace: boolean;
	workspaces: workspaceinfo[];
	isOwner: boolean;
}

const loginState = atom<LoginState>({
	key: "loginState",
	default: {
		userId: 1,
		username: '',
		displayname: '',
		thumbnail: '',
		canMakeWorkspace: false,
		workspaces: [] as workspaceinfo[],
		isOwner: false
	},
});

const workspacestate = atom({
	key: "workspacestate",
	default: {
		groupId: typeof window !== 'undefined' ? parseInt(window.location.pathname.split('/')[2]) || 1 : 1,
		groupThumbnail: '',
		groupName: '',
		yourPermission: [] as string[],
		isAdmin: false,
		ownerId: null as number | null,
		groupTheme: '',
		roles: [] as role[],
		yourRole: '',
		settings: {
			guidesEnabled: true,
			sessionsEnabled: true,
			alliesEnabled: false,
			noticesEnabled: true,
			leaderboardEnabled: true,
			policiesEnabled: false,
			recommendationsEnabled: false,
			moderationEnabled: false,
			widgets: [] as string[],
			bannerImage: null as string | null,
			layout: undefined as Array<{
				i: string;
				x: number;
				y: number;
				w: number;
				h: number;
				minW?: number;
				minH?: number;
				maxW?: number;
				maxH?: number;
			}> | undefined
		}
	}
});

const createWorkspaceModalState = atom({
	key: "createWorkspaceModalState",
	default: false
});

const dashboardEditingState = atom({
	key: "dashboardEditingState",
	default: false
});

export {loginState, workspacestate, createWorkspaceModalState, dashboardEditingState};