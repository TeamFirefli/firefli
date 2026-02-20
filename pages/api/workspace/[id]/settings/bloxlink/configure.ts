import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';
import { BloxlinkAPI, encryptApiKey, decryptApiKey } from '@/utils/bloxlink';

type Data = {
  success: boolean;
  error?: string;
  integration?: any;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing workspace id' });
  }

  if (req.method === 'POST') {
    // Configure new integration
    const { apiKey, discordServerId, notifyPromotion, notifyDemotion, notifyWarning, notifyActivityReview } = req.body;

    if (!apiKey || !discordServerId) {
      return res.status(400).json({
        success: false,
        error: 'API key and Discord server ID are required'
      });
    }

    try {
      // Validate API key with Bloxlink
      const bloxlink = new BloxlinkAPI(apiKey.trim(), discordServerId.trim());
      const isValid = await bloxlink.validateApiKey();

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Bloxlink API key or server ID'
        });
      }

      // Encrypt API key for storage
      const encryptedApiKey = encryptApiKey(apiKey.trim());

      // Create or update integration
      const integration = await prisma.bloxlinkIntegration.upsert({
        where: { workspaceGroupId: workspaceId },
        create: {
          workspaceGroupId: workspaceId,
          apiKey: encryptedApiKey,
          discordServerId: discordServerId.trim(),
          isActive: true,
          notifyPromotion: notifyPromotion ?? true,
          notifyDemotion: notifyDemotion ?? true,
          notifyWarning: notifyWarning ?? true,
          notifyActivityReview: notifyActivityReview ?? false,
          errorCount: 0,
          lastError: null,
        },
        update: {
          apiKey: encryptedApiKey,
          discordServerId: discordServerId.trim(),
          isActive: true,
          notifyPromotion: notifyPromotion ?? true,
          notifyDemotion: notifyDemotion ?? true,
          notifyWarning: notifyWarning ?? true,
          notifyActivityReview: notifyActivityReview ?? false,
          errorCount: 0,
          lastError: null,
        },
      });

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
        },
      });
    } catch (error: any) {
      console.error('[Bloxlink] Configuration error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to configure Bloxlink integration'
      });
    }
  }

  if (req.method === 'PATCH') {
    // Update existing integration settings
    const { discordServerId, notifyPromotion, notifyDemotion, notifyWarning, notifyActivityReview } = req.body;

    try {
      const integration = await prisma.bloxlinkIntegration.findUnique({
        where: { workspaceGroupId: workspaceId },
      });

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Bloxlink integration not found'
        });
      }

      // If Discord server ID is being changed, validate with existing API key
      if (discordServerId && discordServerId !== integration.discordServerId) {
        const decryptedApiKey = decryptApiKey(integration.apiKey);
        const bloxlink = new BloxlinkAPI(decryptedApiKey, discordServerId.trim());
        const isValid = await bloxlink.validateApiKey();

        if (!isValid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Discord server ID for this API key'
          });
        }
      }

      const updatedIntegration = await prisma.bloxlinkIntegration.update({
        where: { workspaceGroupId: workspaceId },
        data: {
          discordServerId: discordServerId?.trim() || integration.discordServerId,
          notifyPromotion: notifyPromotion ?? integration.notifyPromotion,
          notifyDemotion: notifyDemotion ?? integration.notifyDemotion,
          notifyWarning: notifyWarning ?? integration.notifyWarning,
          notifyActivityReview: notifyActivityReview ?? integration.notifyActivityReview,
        },
      });

      return res.status(200).json({
        success: true,
        integration: {
          id: updatedIntegration.id,
          discordServerId: updatedIntegration.discordServerId,
          isActive: updatedIntegration.isActive,
          notifyPromotion: updatedIntegration.notifyPromotion,
          notifyDemotion: updatedIntegration.notifyDemotion,
          notifyWarning: updatedIntegration.notifyWarning,
          notifyActivityReview: updatedIntegration.notifyActivityReview,
        },
      });
    } catch (error: any) {
      console.error('[Bloxlink] Update error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update Bloxlink integration'
      });
    }
  }

  if (req.method === 'DELETE') {
    // Disconnect integration
    try {
      await prisma.bloxlinkIntegration.delete({
        where: { workspaceGroupId: workspaceId },
      });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[Bloxlink] Delete error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to disconnect Bloxlink integration'
      });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
