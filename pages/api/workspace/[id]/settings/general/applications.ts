import type { NextApiRequest, NextApiResponse } from 'next'
import { getConfig, setConfig } from '@/utils/configEngine'
import { withPermissionCheck } from '@/utils/permissionsManager'
import { withSessionRoute } from '@/lib/withSession'

type Data = {
  success: boolean
  error?: string
  value?: any
}

export default withSessionRoute(handler);

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const userId = (req as any).session?.userid;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const config = await getConfig('applications', parseInt(req.query.id as string));
    if (!config) {
      return res.status(200).json({ success: true, value: { enabled: false } });
    }
    return res.status(200).json({ success: true, value: config });
  }

  if (req.method === 'PATCH') {
    return withPermissionCheck(async (req: NextApiRequest, res: NextApiResponse<Data>) => {
      const existing = await getConfig('applications', parseInt(req.query.id as string));
      const enabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : (existing?.enabled ?? false);
      await setConfig('applications', { enabled }, parseInt(req.query.id as string));
      try {
        const { logAudit } = await import('@/utils/logs');
        await logAudit(parseInt(req.query.id as string), (req as any).session?.userid || null, 'settings.update', 'applications', { enabled });
      } catch (e) {}
      return res.status(200).json({ success: true });
    }, 'manage_features')(req, res);
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
