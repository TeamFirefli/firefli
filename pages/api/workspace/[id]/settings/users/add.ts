// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchworkspace, getConfig, setConfig } from '@/utils/configEngine'
import prisma, { user }from '@/utils/database';
import { withSessionRoute } from '@/lib/withSession'
import { withPermissionCheck } from '@/utils/permissionsManager'
import { logAudit } from '@/utils/logs';
import { getUsername, getThumbnail, getDisplayName } from '@/utils/userinfoEngine'
import { getRobloxUsername, getRobloxThumbnail, getRobloxDisplayName, getRobloxUserId } from "@/utils/roblox";
import { getWorkspaceRobloxApiKey } from "@/utils/openCloud";
type Data = {
	success: boolean
	error?: string
	user?: any
}

export default withPermissionCheck(handler, 'admin');

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
	const userid = await getRobloxUserId(req.body.username).catch(() => null) as bigint | null;
	if (!userid) return res.status(400).json({ success: false, error: 'Invalid username' });

	const role = await prisma.role.findFirst({
		where: {
			workspaceGroupId: parseInt(req.query.id as string),
		}
	});
	const u = await prisma.user.findFirst({
		where: {
			userid: userid,
			roles: {
				some: {
					workspaceGroupId: parseInt(req.query.id as string)
				}
			}
		},
	});
	if (u) return res.status(400).json({ success: false, error: 'User already exists' });
	if (!role) return res.status(404).json({ success: false, error: 'Role not found' });

	const user = await prisma.user.upsert({
		where: {
			userid: userid
		},
		update: {
			username: await getUsername(userid),
			roles: {
				connect: {
					id: role.id
				}
			}
		},
		create: {
			userid: userid,
			username: await getUsername(userid),

			roles: {
				connect: {
					id: role.id
				}
			}
		},
	});

	await prisma.roleMember.upsert({
		where: {
			roleId_userId: {
				roleId: role.id,
				userId: userid
			}
		},
		update: {
			manuallyAdded: true
		},
		create: {
			roleId: role.id,
			userId: userid,
			manuallyAdded: true
		}
	});
	
	const workspaceGroupId = parseInt(req.query.id as string);
	let robloxRoleId: number = 0;
	const userIdNum = Number(userid);
	
	try {
		const apiKey = await getWorkspaceRobloxApiKey(workspaceGroupId);
		if (apiKey) {
			const ocRes = await fetch(
				`https://apis.roblox.com/cloud/v2/groups/${workspaceGroupId}/memberships?filter=user == 'users/${userIdNum}'&maxPageSize=1`,
				{ headers: { "x-api-key": apiKey } },
			);
			if (ocRes.ok) {
				const data = await ocRes.json();
				if (data.groupMemberships?.[0]?.role) {
					const rolePath = data.groupMemberships[0].role;
					const match = rolePath.match(/roles\/(\d+)/);
					if (match) {
						robloxRoleId = parseInt(match[1]);
						console.log(`[Add User] Fetched Roblox role ID ${robloxRoleId} for user ${userIdNum} in group ${workspaceGroupId}`);
					}
				} else {
					console.log(`[Add User] User ${userIdNum} is not in group ${workspaceGroupId}, setting role to 0 (Guest)`);
				}
			} else {
				console.warn(`[Add User] Open Cloud API returned status ${ocRes.status} for user ${userIdNum}`);
			}
		} else {
			try {
				const v2Res = await fetch(`https://groups.roblox.com/v2/users/${userIdNum}/groups/roles`);
				if (v2Res.ok) {
					const v2Data = await v2Res.json();
					const membership = v2Data.data?.find((g: any) => g.group?.id === workspaceGroupId);
					if (membership?.role?.id) {
						robloxRoleId = membership.role.id;
						console.log(`[Add User] Roblox v2 API: fetched role ID ${robloxRoleId} for user ${userIdNum} in group ${workspaceGroupId}`);
					} else {
						console.log(`[Add User] User ${userIdNum} is not in group ${workspaceGroupId}, setting role to 0 (Guest)`);
					}
				} else {
					console.warn(`[Add User] Roblox v2 API returned status ${v2Res.status} for user ${userIdNum}`);
				}
			} catch (v2Err) {
				console.warn(`[Add User] Roblox v2 API fallback failed for user ${userIdNum}:`, v2Err);
			}
		}
	} catch (e) {
		console.error(`[Add User] Failed to fetch Roblox role for user ${userIdNum}:`, e);
	}
	
	await prisma.rank.upsert({
		where: {
			userId_workspaceGroupId: {
				userId: userid,
				workspaceGroupId: workspaceGroupId,
			},
		},
		update: {
			rankId: BigInt(robloxRoleId),
		},
		create: {
			userId: userid,
			workspaceGroupId: workspaceGroupId,
			rankId: BigInt(robloxRoleId),
		},
	});
	
	await prisma.workspaceMember.upsert({
		where: {
			workspaceGroupId_userId: {
				workspaceGroupId: parseInt(req.query.id as string),
				userId: userid
			}
		},
		update: {},
		create: {
			workspaceGroupId: parseInt(req.query.id as string),
			userId: userid,
			joinDate: new Date(),
			isAdmin: false
		}
	});
	
	const newuser = {
		roles: [
			role
		],
		userid: Number(user.userid),
		username: req.body.username,
		displayName: await getDisplayName(userid),
		thumbnail: await getThumbnail(userid)
	}

	try { await logAudit(parseInt(req.query.id as string), (req as any).session?.userid || null, 'settings.users.add', `user:${Number(user.userid)}`, { userId: Number(user.userid), username: req.body.username, role: role.id }); } catch (e) {}

	res.status(200).json({ success: true, user: newuser })
}
