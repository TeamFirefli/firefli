import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig } from '@/utils/configEngine';
import { withPermissionCheck } from '@/utils/permissionsManager';

export default withPermissionCheck(handler);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false });
  const workspaceId = parseInt(req.query.id as string, 10);
  const config = await getConfig('home', workspaceId);
  const bannerImage = config?.bannerImage ?? null;
  return res.status(200).json({
    bannerImage: typeof bannerImage === 'string' && bannerImage.startsWith('data:') ? bannerImage : null,
  });
}
