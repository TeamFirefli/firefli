import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';
import { decryptToken } from '@/utils/discord';

type Data = {
  success: boolean;
  error?: string;
  integration?: Record<string, any> | null;
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
    const integration = await prisma.discordIntegration.findUnique({
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
        guildId: integration.guildId,
        guildName: integration.guildName || integration.guildId,
        channelId: integration.channelId,
        channelName: integration.channelName || integration.channelId,
        birthdayChannelId: integration.birthdayChannelId,
        birthdayChannelName: integration.birthdayChannelName || integration.birthdayChannelId,
        birthdayEnabled: integration.birthdayEnabled,
        embedTitle: integration.embedTitle,
        embedColor: integration.embedColor,
        embedFooter: integration.embedFooter,
        embedThumbnail: integration.embedThumbnail,
        // Per-category embed fields
        promotionEmbedTitle: integration.promotionEmbedTitle,
        promotionEmbedColor: integration.promotionEmbedColor,
        promotionEmbedDescription: integration.promotionEmbedDescription,
        promotionEmbedFooter: integration.promotionEmbedFooter,
        demotionEmbedTitle: integration.demotionEmbedTitle,
        demotionEmbedColor: integration.demotionEmbedColor,
        demotionEmbedDescription: integration.demotionEmbedDescription,
        demotionEmbedFooter: integration.demotionEmbedFooter,
        warningEmbedTitle: integration.warningEmbedTitle,
        warningEmbedColor: integration.warningEmbedColor,
        warningEmbedDescription: integration.warningEmbedDescription,
        warningEmbedFooter: integration.warningEmbedFooter,
        terminationEmbedTitle: integration.terminationEmbedTitle,
        terminationEmbedColor: integration.terminationEmbedColor,
        terminationEmbedDescription: integration.terminationEmbedDescription,
        terminationEmbedFooter: integration.terminationEmbedFooter,
        birthdayEmbedTitle: integration.birthdayEmbedTitle,
        birthdayEmbedColor: integration.birthdayEmbedColor,
        birthdayEmbedDescription: integration.birthdayEmbedDescription,
        // Notice embed fields
        noticeSubmitEmbedTitle: integration.noticeSubmitEmbedTitle,
        noticeSubmitEmbedColor: integration.noticeSubmitEmbedColor,
        noticeSubmitEmbedDescription: integration.noticeSubmitEmbedDescription,
        noticeSubmitEmbedFooter: integration.noticeSubmitEmbedFooter,
        noticeApprovalEmbedTitle: integration.noticeApprovalEmbedTitle,
        noticeApprovalEmbedColor: integration.noticeApprovalEmbedColor,
        noticeApprovalEmbedDescription: integration.noticeApprovalEmbedDescription,
        noticeApprovalEmbedFooter: integration.noticeApprovalEmbedFooter,
        noticeDenialEmbedTitle: integration.noticeDenialEmbedTitle,
        noticeDenialEmbedColor: integration.noticeDenialEmbedColor,
        noticeDenialEmbedDescription: integration.noticeDenialEmbedDescription,
        noticeDenialEmbedFooter: integration.noticeDenialEmbedFooter,
        // Session notification fields
        sessionChannelId: integration.sessionChannelId,
        sessionChannelName: integration.sessionChannelName || integration.sessionChannelId,
        sessionNotifyOnCreate: integration.sessionNotifyOnCreate,
        sessionNotifyOnClaim: integration.sessionNotifyOnClaim,
        sessionNotifyOnStart: integration.sessionNotifyOnStart,
        sessionEmbedTitle: integration.sessionEmbedTitle,
        sessionEmbedColor: integration.sessionEmbedColor,
        sessionEmbedDescription: integration.sessionEmbedDescription,
        sessionEmbedFooter: integration.sessionEmbedFooter,
        sessionReviewEmbedTitle: integration.sessionReviewEmbedTitle,
        sessionReviewEmbedColor: integration.sessionReviewEmbedColor,
        sessionReviewEmbedDescription: integration.sessionReviewEmbedDescription,
        sessionReviewEmbedFooter: integration.sessionReviewEmbedFooter,
        sessionPingRoleId: integration.sessionPingRoleId,
        sessionPingRoleName: integration.sessionPingRoleName,
        pingRoles: integration.pingRoles as Record<string, string> || null,
        enabledEvents: integration.enabledEvents as string[],
        isActive: integration.isActive,
        lastMessageAt: integration.lastMessageAt?.toISOString() || null,
        errorCount: integration.errorCount,
        lastError: integration.lastError,
      },
    });
  } catch (error: any) {
    console.error('[Discord] Status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Discord integration status'
    });
  }
}
