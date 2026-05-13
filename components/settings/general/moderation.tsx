import axios from "axios";
import React from "react";
import { useRouter } from "next/router";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import SwitchComponenet from "@/components/switch";
import { workspacestate } from "@/state";
import { FC } from '@/types/settingsComponent'
import { IconDownload, IconShield } from "@tabler/icons-react";

type props = {
	triggerToast: typeof toast;
}

const Guide: FC<props> = (props) => {
	const triggerToast = props.triggerToast;
	const router = useRouter();
	const [workspace, setWorkspace] = useRecoilState(workspacestate);

	const toggle = async () => {
		const res = await axios.patch(`/api/workspace/${workspace.groupId}/settings/general/moderation`, {
			enabled: !workspace.settings.moderationEnabled
		});
		if (res.status === 200) {
			const obj = JSON.parse(JSON.stringify(workspace), (key, value) => (typeof value === 'bigint' ? value.toString() : value));
			obj.settings.moderationEnabled = !workspace.settings.moderationEnabled;
			setWorkspace(obj);
			triggerToast.success("Updated moderation!");
		} else {
			triggerToast.error("Failed to update moderation.");
		}
	};

	return (
		<div>
			<div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
				<div className="flex items-center gap-3">
					<div className="p-2 bg-primary/10 rounded-lg">
						<IconShield size={20} className="text-primary" />
					</div>
					<div>
						<p className="text-sm font-medium text-zinc-900 dark:text-white inline-flex items-center gap-2">
							Moderation
							<span className="px-1.5 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
								BETA
							</span>
						</p>
						<p className="text-xs text-zinc-500 dark:text-zinc-400">Create and manage moderation cases and bans</p>
					</div>
				</div>
				<SwitchComponenet
					checked={workspace.settings?.moderationEnabled}
					onChange={toggle}
					label=""
					classoverride="mt-0"
				/>
			</div>
			{workspace.settings?.moderationEnabled && (
				<div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
					<p className="text-sm font-medium text-zinc-900 dark:text-white mb-2">Roblox Module</p>
					<p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
						Install the moderation module in your Roblox experience to sync bans/kicks in-game.
					</p>
					<button
						onClick={() => window.open(`/api/workspace/${router.query.id}/settings/moderation/download`)}
						className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
					>
						<IconDownload className="w-4 h-4" />
						Download module
					</button>
				</div>
			)}
		</div>
	);
};

Guide.title = "Moderation";

export default Guide;
