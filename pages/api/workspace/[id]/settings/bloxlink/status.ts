import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';

type Data = {
  success: boolean;
  error?: string;
  integration?: {
    id: string;
    discordServerId: string;
    isActive: boolean;
    notifyPromotion: boolean;
    notifyDemotion: boolean;
    notifyWarning: boolean;
    notifyActivityReview: boolean;
    messageTemplate: any;
    lastUsed: string | null;
    errorCount: number;
    lastError: string | null;
  } | null;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing workspace id' });
  }

  try {
    const integration = await prisma.bloxlinkIntegration.findUnique({
      where: {
        workspaceGroupId: workspaceId,
      },
    });

    if (!integration) {
      return res.status(200).json({
        success: true,
        integration: null,
      });
    }

    return res.status(200).json({
      success: true,
      integration: {
        id: integration.id,
        discordServerId: integration.discordServerId,
        isActive: integration.isActive,
        notifyPromotion: integration.notifyPromotion,
        notifyDemotion: integration.notifyDemotion,
        notifyWarning: integration.notifyWarning,
        notifyActivityReview: integration.notifyActivityReview,
        messageTemplate: integration.messageTemplate,
        lastUsed: integration.lastUsed?.toISOString() || null,
        errorCount: integration.errorCount,
        lastError: integration.lastError,
      },
    });
  } catch (error: any) {
    console.error('[Bloxlink] Status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Bloxlink integration status'
    });
  }
}
