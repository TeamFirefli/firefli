import type { NextApiRequest, NextApiResponse } from 'next';
import { withSessionRoute } from '@/lib/withSession';
import prisma from '@/utils/database';

type Data = {
  success: boolean;
  error?: string;
  bloxlinkActive?: boolean;
  discordActive?: boolean;
};

export default withSessionRoute(handler);

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!req.session.userid) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing workspace id' });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceGroupId_userId: {
        workspaceGroupId: workspaceId,
        userId: Number(req.session.userid),
      },
    },
  });

  if (!membership) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const [bloxlinkIntegration, discordIntegration] = await Promise.all([
      prisma.bloxlinkIntegration.findUnique({
        where: { workspaceGroupId: workspaceId },
        select: { isActive: true },
      }),
      prisma.discordIntegration.findUnique({
        where: { workspaceGroupId: workspaceId },
        select: { isActive: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      bloxlinkActive: bloxlinkIntegration?.isActive ?? false,
      discordActive: discordIntegration?.isActive ?? false,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to check DM.' });
  }
}
