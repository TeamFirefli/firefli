import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig, setConfig } from '@/utils/configEngine';
import { withPermissionCheck } from '@/utils/permissionsManager';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default withPermissionCheck(handler, 'workspace_customisation');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = parseInt(req.query.id as string, 10);
  if (!workspaceId) return res.status(400).json({ success: false, error: 'Invalid workspace id.' });

  if (req.method === 'GET') {
    const config = await getConfig('home', workspaceId);
    return res.status(200).json({ success: true, bannerImage: config?.bannerImage ?? null });
  }

  if (req.method === 'PATCH') {
    const { bannerImage } = req.body;
    if (!bannerImage) {
      const current = await getConfig('home', workspaceId);
      await setConfig('home', { ...current, bannerImage: null }, workspaceId);
      return res.status(200).json({ success: true, bannerImage: null });
    }

    if (typeof bannerImage !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid image data.' });
    }

    if (!bannerImage.match(/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/)) {
      return res.status(400).json({ success: false, error: 'Only PNG, JPEG, WebP or GIF images are allowed.' });
    }

    if (bannerImage.length > 14 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Image must be under 10 MB.' });
    }

    const current = await getConfig('home', workspaceId);
    await setConfig('home', { ...current, bannerImage }, workspaceId);

    return res.status(200).json({ success: true, bannerImage });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed.' });
}
