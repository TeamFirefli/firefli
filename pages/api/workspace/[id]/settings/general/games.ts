import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig, setConfig } from '@/utils/configEngine';
import { withPermissionCheck } from '@/utils/permissionsManager';

export default withPermissionCheck(handler, 'workspace_customisation');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = parseInt(req.query.id as string, 10);
  if (!workspaceId) return res.status(400).json({ success: false, error: 'Invalid workspace id' });

  if (req.method === 'GET') {
    const config = await getConfig('games', workspaceId);
    return res.status(200).json({ success: true, placeIds: config?.placeIds ?? [] });
  }

  if (req.method === 'PATCH') {
    const raw: unknown[] = Array.isArray(req.body?.placeIds) ? req.body.placeIds : [];
    const sanitized = raw
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    const capped = sanitized.slice(0, 10);
    await setConfig('games', { placeIds: capped }, workspaceId);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
