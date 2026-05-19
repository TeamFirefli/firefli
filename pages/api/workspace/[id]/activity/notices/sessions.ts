import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';
import { withPermissionCheck } from '@/utils/permissionsManager';

type SessionConflict = {
  id: string;
  name: string | null;
  date: string;
  sessionTypeName: string;
};

type Data = {
  success: boolean;
  error?: string;
  sessions?: SessionConflict[];
};

export default withPermissionCheck(handler, 'create_notices');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!req.session.userid) {
    return res.status(401).json({ success: false, error: 'Not logged in' });
  }

  const { startTime, endTime } = req.body;

  if (!startTime || !endTime || typeof startTime !== 'number' || typeof endTime !== 'number') {
    return res.status(400).json({ success: false, error: 'Invalid startTime or endTime' });
  }

  const workspaceGroupId = parseInt(req.query.id as string);

  try {
    const sessions = await prisma.session.findMany({
      where: {
        startedAt: null,
        date: {
          gte: new Date(startTime),
          lte: new Date(endTime + 86399999),
        },
        sessionType: {
          workspaceGroupId,
        },
        OR: [
          { ownerId: BigInt(req.session.userid) },
          { users: { some: { userid: BigInt(req.session.userid) } } },
        ],
      },
      select: {
        id: true,
        name: true,
        date: true,
        sessionType: {
          select: { name: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    return res.status(200).json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        name: s.name,
        date: s.date.toISOString(),
        sessionTypeName: s.sessionType.name,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
