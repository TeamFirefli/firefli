// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchworkspace, getConfig, setConfig } from '@/utils/configEngine'
import { logAudit } from '@/utils/logs'
import prisma, {role} from '@/utils/database';
import { withSessionRoute } from '@/lib/withSession'
import { withPermissionCheck } from '@/utils/permissionsManager'
import { getUsername, getThumbnail, getDisplayName } from '@/utils/userinfoEngine'
import { get } from 'react-hook-form';
type Data = {
	success: boolean
	error?: string
	widgets?: string[]
}

export interface WidgetLayout {
	i: string; // widget id
	x: number;
	y: number;
	w: number;
	h: number;
	minW?: number;
	minH?: number;
	maxW?: number;
	maxH?: number;
}

export default withPermissionCheck(handler, 'workspace_customisation');

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'PATCH') return res.status(405).json({ success: false, error: 'Method not allowed' })
	try {
		const workspaceId = parseInt(req.query.id as string);
		const before = await getConfig('home', workspaceId);
		const allowedWidgets = new Set(['sessions', 'wall', 'documents', 'notices', 'birthdays', 'new_members', 'sticky_notes', 'quota', 'games']);
		const requestedWidgets = Array.isArray(req.body?.widgets) ? req.body.widgets : [];
		const sanitizedWidgets = requestedWidgets.filter((w: unknown): w is string => typeof w === 'string' && allowedWidgets.has(w));
		const after: { widgets: string[]; layout?: WidgetLayout[]; bannerImage?: string | null } = { 
			widgets: sanitizedWidgets,
			...(before?.bannerImage != null ? { bannerImage: before.bannerImage } : {}),
		};
		
		// If layout is provided, store it
		if (req.body.layout && Array.isArray(req.body.layout)) {
			const layoutByWidget = new Map<string, WidgetLayout>();
			for (const item of req.body.layout as WidgetLayout[]) {
				if (!item || typeof item.i !== 'string' || !allowedWidgets.has(item.i)) continue;
				layoutByWidget.set(item.i, {
					i: item.i,
					x: Number.isFinite(item.x) ? item.x : 0,
					y: Number.isFinite(item.y) ? item.y : 0,
					w: Number.isFinite(item.w) && item.w >= 1 && item.w <= 12 ? Math.round(item.w) : 6,
					h: Number.isFinite(item.h) && item.h > 0 ? item.h : 4,
					minW: 4,
					minH: 1,
					maxW: 12,
					maxH: item.maxH,
				});
			}

			after.layout = sanitizedWidgets.map((widget: string, index: number) => {
				const existing = layoutByWidget.get(widget);
				return existing || {
					i: widget,
					x: (index % 2) * 6,
					y: Math.floor(index / 2) * 4,
					w: 6,
					h: 4,
					minW: 4,
					minH: 1,
					maxW: 12,
				};
			});
		}
		
		await setConfig('home', after, workspaceId);
		try { await logAudit(workspaceId, (req as any).session?.userid || null, 'settings.general.home.update', 'home', { before, after }); } catch (e) {}
		res.status(200).json({ success: true})
	} catch (error) {
		console.error('Failed to save home settings:', error);
		return res.status(500).json({ success: false, error: 'Server error' });
	}
}
