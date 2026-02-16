// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchworkspace, getConfig, setConfig } from '@/utils/configEngine'
import prisma from '@/utils/database';

import { withSessionRoute } from '@/lib/withSession'
import { getUsername, getThumbnail, getDisplayName } from '@/utils/userinfoEngine'
import { getRegistry } from '@/utils/registryManager';
import { getCurrentBatch } from '@/utils/batchScheduler';
import { sendWebhookEmbed } from '@/utils/discord';
import * as noblox from 'noblox.js'

type User = {
	userId: number
	username: string
	canMakeWorkspace: boolean
	displayname: string
	thumbnail: string
}

type Data = {
	success: boolean
	error?: string
	user?: User
	workspaces?: { 
		groupId: number
		groupThumbnail: string
		groupName: string
	}[]
	workspaceGroupId?: number
}

export default withSessionRoute(handler);

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
	// Accept groupId as number or numeric string; optional color (currently unused beyond default)
	let { groupId, robloxApiKey } = req.body || {}
	if (!req.session.userid) return res.status(401).json({ success: false, error: 'Not logged in' });
	const dbuser = await prisma.user.findUnique({
		where: {
			userid: req.session.userid
		}
	});

	if (!dbuser) return res.status(401).json({ success: false, error: 'Not logged in' });
	// Validate and normalize groupId
	if (groupId === undefined || groupId === null) return res.status(400).json({ success: false, error: 'Missing groupId' })
	if (typeof groupId === 'string') {
		if (!/^\d+$/.test(groupId)) return res.status(400).json({ success: false, error: 'Invalid groupId' })
		groupId = parseInt(groupId, 10)
	}
	if (typeof groupId !== 'number' || isNaN(groupId)) return res.status(400).json({ success: false, error: 'Invalid groupId' })

	const tryandfind = await prisma.workspace.findUnique({
		where: {
			groupId: groupId
		}
	})
	if (tryandfind) return res.status(409).json({ success: false, error: 'Workspace already exists' })

	if (process.env.NEXT_PUBLIC_FIREFLI_LIMIT === 'true') {
		const alreadyOwns = await prisma.workspace.findFirst({ where: { ownerId: BigInt(req.session.userid) } })
		if (alreadyOwns) return res.status(403).json({ success: false, error: 'You already own a workspace' })
	}
	const urrole = await noblox.getRankInGroup(groupId, req.session.userid).catch(() => null)
	if (!urrole) return res.status(400).json({ success: false, error: 'You are not a high enough rank' })
	if (urrole < 10) return res.status(400).json({ success: false, error: 'You are not a high enough rank' })

	let groupName = `Group ${groupId}`;
	let groupLogo = '';
	
	try {
		const [logo, group] = await Promise.all([
			noblox.getLogo(groupId).catch(() => ''),
			noblox.getGroup(groupId).catch(() => null)
		]);
		if (group) groupName = group.name;
		if (logo) groupLogo = logo;
	} catch (err) {
		console.error('Failed to fetch group info during workspace creation:', err);
	}

	  const isMultiContainer = process.env.NEXT_MULTI?.toLowerCase() === 'true';
	  const batchId = isMultiContainer ? getCurrentBatch() : null;

	  const workspace = await prisma.$transaction(async (tx) => {
		await tx.user.upsert({
			where: { userid: req.session.userid },
			update: {},
			create: { userid: req.session.userid }
		})

		const ws = await tx.workspace.create({
			data: {
		  groupId,
		  groupName,
		  groupLogo,
		  lastSynced: new Date(),
		  ownerId: BigInt(req.session.userid),
		  batchId
			}
		})

		await tx.workspaceMember.create({
			data: {
				workspaceGroupId: groupId,
				userId: BigInt(req.session.userid),
				joinDate: new Date(),
				isAdmin: true
			}
		})

		const defaultRole = await tx.role.create({
			data: {
				name: 'Default',
				workspaceGroupId: groupId,
				permissions: [],
				groupRoles: []
			}
		})

		await tx.user.update({
			where: { userid: req.session.userid },
			data: {
				roles: {
					connect: { id: defaultRole.id }
				}
			}
		})

		await tx.config.create({
			data: {
				key: 'theme',
				workspaceGroupId: groupId,
				value: 'bg-firefli'
			}
		})

		await tx.config.create({
			data: {
				key: 'customization',
				workspaceGroupId: groupId,
				value: 'bg-firefli'
			}
		})

		await tx.config.createMany({
			data: [
				{
					key: 'guides',
					workspaceGroupId: groupId,
					value: { enabled: true }
				},
				{
					key: 'allies',
					workspaceGroupId: groupId,
					value: { enabled: true }
				},
				{
					key: 'sessions',
					workspaceGroupId: groupId,
					value: { enabled: true }
				},
				{
					key: 'notices',
					workspaceGroupId: groupId,
					value: { enabled: true }
				},
				{
					key: 'policies',
					workspaceGroupId: groupId,
					value: { enabled: false }
				},
				{
					key: 'leaderboard',
					workspaceGroupId: groupId,
					value: { enabled: true }
				}
			]
		})
// Removed as secondary workspace creators are NOT the instance owner, which would give them equal access to edit oauth.
		//await tx.user.update({
			//where: { userid: req.session.userid },
			//data: { isOwner: true }
		//})

		return ws
	})

	// Save the Roblox Open Cloud API key if provided
	if (robloxApiKey && typeof robloxApiKey === 'string') {
		try {
			await prisma.workspaceExternalServices.upsert({
				where: { workspaceGroupId: groupId },
				update: { robloxApiKey },
				create: { workspaceGroupId: groupId, robloxApiKey },
			});
		} catch (err) {
			console.error('[createws] Failed to save Roblox API key:', err);
		}
	}

	if (process.env.DISCORD_WELCOME) {
		try {
			const ownerUsername = await getUsername(req.session.userid).catch(() => `User ${req.session.userid}`);

			await sendWebhookEmbed(process.env.DISCORD_WELCOME, {
				title: '🎉 New Workspace Created',
				description: `A new workspace has been created on Firefli!`,
				color: 0x00ff88,
				fields: [
					{ name: '👤 Owner', value: ownerUsername, inline: true },
					{ name: '🆔 Owner ID', value: String(req.session.userid), inline: true },
					{ name: '🏢 Group ID', value: String(groupId), inline: true },
					{ name: '📝 Workspace Name', value: groupName, inline: true },
				],
				thumbnail: groupLogo ? { url: groupLogo } : undefined,
				footer: { text: 'Firefli Workspace' },
			});
		} catch (err) {
			console.error('[createws] Failed to send Discord webhook notification:', err);
		}
	}

	return res.status(200).json({ success: true, workspaceGroupId: workspace.groupId })
}
