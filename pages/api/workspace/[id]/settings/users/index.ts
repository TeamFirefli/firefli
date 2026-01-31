import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';
import { withPermissionCheck } from '@/utils/permissionsManager';
import { getUsername, getDisplayName } from '@/utils/userinfoEngine';

type Data = {
	success: boolean;
	error?: string;
	users?: any[];
};

export default withPermissionCheck(handler, 'admin');

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'GET') {
		return res.status(405).json({ success: false, error: 'Method not allowed' });
	}

	const workspaceGroupId = Number.parseInt(req.query.id as string);

	try {
		const users = await prisma.user.findMany({
			where: {
				roles: {
					some: {
						workspaceGroupId,
					},
				},
			},
			select: {
				userid: true,
				username: true,
				picture: true,
				registered: true,
				roles: {
					where: {
						workspaceGroupId,
					},
					select: {
						id: true,
						name: true,
						isOwnerRole: true,
					},
				},
				workspaceMemberships: {
					where: {
						workspaceGroupId,
					},
					select: {
						isAdmin: true,
						userId: true,
						lineManagerId: true,
						joinDate: true,
					},
				},
			},
		});

		const usersWithInfo = await Promise.all(
			users.map(async (user) => {
				const username = user.username || (await getUsername(user.userid));
				const thumbnail = user.picture || '';
				const displayName = user.username || (await getDisplayName(user.userid));
				return {
					userid: Number(user.userid),
					username,
					thumbnail,
					displayName,
					registered: user.registered,
					roles: user.roles,
					workspaceMemberships: user.workspaceMemberships?.map((m) => ({
						...m,
						userId: Number(m.userId),
						lineManagerId: m.lineManagerId ? Number(m.lineManagerId) : null,
						joinDate: m.joinDate ? m.joinDate.toISOString() : null,
					})),
				};
			})
		);

		return res.status(200).json({ success: true, users: usersWithInfo });
	} catch (error) {
		console.error('Error fetching users:', error);
		return res.status(500).json({ success: false, error: 'Internal server error' });
	}
}
