import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';
import DiscordAPI, { encryptToken } from '@/utils/discord';
import { logAudit } from '@/utils/logs';

type Data = {
  success: boolean;
  error?: string;
  integration?: Record<string, any>;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing workspace id' });
  }

  const {
    botToken, guildId, channelId, enabledEvents, guildName, channelName,
    birthdayChannelId, birthdayChannelName, birthdayEnabled,
    embedTitle, embedColor, embedFooter, embedThumbnail,
    // User action embed templates
    promotionEmbedTitle, promotionEmbedColor, promotionEmbedDescription, promotionEmbedFooter,
    demotionEmbedTitle, demotionEmbedColor, demotionEmbedDescription, demotionEmbedFooter,
    warningEmbedTitle, warningEmbedColor, warningEmbedDescription, warningEmbedFooter,
    terminationEmbedTitle, terminationEmbedColor, terminationEmbedDescription, terminationEmbedFooter,
    // Birthday embed templates
    birthdayEmbedTitle, birthdayEmbedColor, birthdayEmbedDescription,
    // Notice embed templates
    noticeSubmitEmbedTitle, noticeSubmitEmbedColor, noticeSubmitEmbedDescription, noticeSubmitEmbedFooter,
    noticeApprovalEmbedTitle, noticeApprovalEmbedColor, noticeApprovalEmbedDescription, noticeApprovalEmbedFooter,
    noticeDenialEmbedTitle, noticeDenialEmbedColor, noticeDenialEmbedDescription, noticeDenialEmbedFooter,
    // Session notification fields
    sessionChannelId, sessionChannelName,
    sessionNotifyOnCreate, sessionNotifyOnClaim, sessionNotifyOnStart,
    sessionEmbedTitle, sessionEmbedColor, sessionEmbedDescription, sessionEmbedFooter,
    // Session review embed templates
    sessionReviewEmbedTitle, sessionReviewEmbedColor, sessionReviewEmbedDescription, sessionReviewEmbedFooter,
    sessionPingRoleId, sessionPingRoleName,
    pingRoles,
  } = req.body;

  let actualBotToken = botToken;
  let skipTestMessage = false;

  // Handle case where we're updating an existing integration
  if (botToken === "existing") {
    const existingIntegration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId: workspaceId },
    });

    if (!existingIntegration) {
      return res.status(400).json({ success: false, error: 'No existing integration found' });
    }

    actualBotToken = existingIntegration.botToken; // This is already encrypted
    skipTestMessage = true; // Skip test message for updates
  } else {
    if (!botToken || typeof botToken !== 'string') {
      return res.status(400).json({ success: false, error: 'Bot token is required' });
    }
  }
  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ success: false, error: 'Guild ID is required' });
  }
  if (!channelId || typeof channelId !== 'string') {
    return res.status(400).json({ success: false, error: 'Channel ID is required' });
  }
  // guildName and channelName are optional for backward compatibility
  if (!Array.isArray(enabledEvents)) {
    return res.status(400).json({ success: false, error: 'Enabled events must be an array' });
  }

  try {
    let encryptedToken = actualBotToken;

    // Only test connection and encrypt if not using existing token
    if (!skipTestMessage) {
      const discord = new DiscordAPI(actualBotToken);

      // Test the connection by sending a test message
      const connectionTest = await discord.testConnection(channelId);
      if (!connectionTest) {
        return res.status(400).json({
          success: false,
          error: 'Failed to send test message to channel. Please check bot permissions.'
        });
      }

      // Encrypt the bot token before storing
      encryptedToken = encryptToken(actualBotToken);
    }

    // Upsert the Discord integration
    const integration = await prisma.discordIntegration.upsert({
      where: {
        workspaceGroupId: workspaceId,
      },
      update: {
        botToken: encryptedToken,
        guildId,
        guildName: guildName || null,
        channelId,
        channelName: channelName || null,
        birthdayChannelId: birthdayChannelId || null,
        birthdayChannelName: birthdayChannelName || null,
        birthdayEnabled: birthdayEnabled || false,
        embedTitle: embedTitle || null,
        embedColor: embedColor || null,
        embedFooter: embedFooter || null,
        embedThumbnail: embedThumbnail !== undefined ? embedThumbnail : true,
        // User action embed templates
        promotionEmbedTitle: promotionEmbedTitle || null,
        promotionEmbedColor: promotionEmbedColor || null,
        promotionEmbedDescription: promotionEmbedDescription || null,
        promotionEmbedFooter: promotionEmbedFooter || null,
        demotionEmbedTitle: demotionEmbedTitle || null,
        demotionEmbedColor: demotionEmbedColor || null,
        demotionEmbedDescription: demotionEmbedDescription || null,
        demotionEmbedFooter: demotionEmbedFooter || null,
        warningEmbedTitle: warningEmbedTitle || null,
        warningEmbedColor: warningEmbedColor || null,
        warningEmbedDescription: warningEmbedDescription || null,
        warningEmbedFooter: warningEmbedFooter || null,
        terminationEmbedTitle: terminationEmbedTitle || null,
        terminationEmbedColor: terminationEmbedColor || null,
        terminationEmbedDescription: terminationEmbedDescription || null,
        terminationEmbedFooter: terminationEmbedFooter || null,
        // Birthday embed templates
        birthdayEmbedTitle: birthdayEmbedTitle || null,
        birthdayEmbedColor: birthdayEmbedColor || null,
        birthdayEmbedDescription: birthdayEmbedDescription || null,
        // Notice embed templates
        noticeSubmitEmbedTitle: noticeSubmitEmbedTitle || null,
        noticeSubmitEmbedColor: noticeSubmitEmbedColor || null,
        noticeSubmitEmbedDescription: noticeSubmitEmbedDescription || null,
        noticeSubmitEmbedFooter: noticeSubmitEmbedFooter || null,
        noticeApprovalEmbedTitle: noticeApprovalEmbedTitle || null,
        noticeApprovalEmbedColor: noticeApprovalEmbedColor || null,
        noticeApprovalEmbedDescription: noticeApprovalEmbedDescription || null,
        noticeApprovalEmbedFooter: noticeApprovalEmbedFooter || null,
        noticeDenialEmbedTitle: noticeDenialEmbedTitle || null,
        noticeDenialEmbedColor: noticeDenialEmbedColor || null,
        noticeDenialEmbedDescription: noticeDenialEmbedDescription || null,
        noticeDenialEmbedFooter: noticeDenialEmbedFooter || null,
        // Session notification fields
        sessionChannelId: sessionChannelId || null,
        sessionChannelName: sessionChannelName || null,
        sessionNotifyOnCreate: sessionNotifyOnCreate || false,
        sessionNotifyOnClaim: sessionNotifyOnClaim || false,
        sessionNotifyOnStart: sessionNotifyOnStart || false,
        sessionEmbedTitle: sessionEmbedTitle || null,
        sessionEmbedColor: sessionEmbedColor || null,
        sessionEmbedDescription: sessionEmbedDescription || null,
        sessionEmbedFooter: sessionEmbedFooter || null,
        // Session review embed templates
        sessionReviewEmbedTitle: sessionReviewEmbedTitle || null,
        sessionReviewEmbedColor: sessionReviewEmbedColor || null,
        sessionReviewEmbedDescription: sessionReviewEmbedDescription || null,
        sessionReviewEmbedFooter: sessionReviewEmbedFooter || null,
        sessionPingRoleId: sessionPingRoleId || null,
        sessionPingRoleName: sessionPingRoleName || null,
        pingRoles: pingRoles || null,
        enabledEvents,
        isActive: true,
        lastMessageAt: new Date(),
        errorCount: 0,
        lastError: null,
      },
      create: {
        workspaceGroupId: workspaceId,
        botToken: encryptedToken,
        guildId,
        guildName: guildName || null,
        channelId,
        channelName: channelName || null,
        birthdayChannelId: birthdayChannelId || null,
        birthdayChannelName: birthdayChannelName || null,
        birthdayEnabled: birthdayEnabled || false,
        embedTitle: embedTitle || null,
        embedColor: embedColor || null,
        embedFooter: embedFooter || null,
        embedThumbnail: embedThumbnail !== undefined ? embedThumbnail : true,
        // User action embed templates
        promotionEmbedTitle: promotionEmbedTitle || null,
        promotionEmbedColor: promotionEmbedColor || null,
        promotionEmbedDescription: promotionEmbedDescription || null,
        promotionEmbedFooter: promotionEmbedFooter || null,
        demotionEmbedTitle: demotionEmbedTitle || null,
        demotionEmbedColor: demotionEmbedColor || null,
        demotionEmbedDescription: demotionEmbedDescription || null,
        demotionEmbedFooter: demotionEmbedFooter || null,
        warningEmbedTitle: warningEmbedTitle || null,
        warningEmbedColor: warningEmbedColor || null,
        warningEmbedDescription: warningEmbedDescription || null,
        warningEmbedFooter: warningEmbedFooter || null,
        terminationEmbedTitle: terminationEmbedTitle || null,
        terminationEmbedColor: terminationEmbedColor || null,
        terminationEmbedDescription: terminationEmbedDescription || null,
        terminationEmbedFooter: terminationEmbedFooter || null,
        // Birthday embed templates
        birthdayEmbedTitle: birthdayEmbedTitle || null,
        birthdayEmbedColor: birthdayEmbedColor || null,
        birthdayEmbedDescription: birthdayEmbedDescription || null,
        // Notice embed templates
        noticeSubmitEmbedTitle: noticeSubmitEmbedTitle || null,
        noticeSubmitEmbedColor: noticeSubmitEmbedColor || null,
        noticeSubmitEmbedDescription: noticeSubmitEmbedDescription || null,
        noticeSubmitEmbedFooter: noticeSubmitEmbedFooter || null,
        noticeApprovalEmbedTitle: noticeApprovalEmbedTitle || null,
        noticeApprovalEmbedColor: noticeApprovalEmbedColor || null,
        noticeApprovalEmbedDescription: noticeApprovalEmbedDescription || null,
        noticeApprovalEmbedFooter: noticeApprovalEmbedFooter || null,
        noticeDenialEmbedTitle: noticeDenialEmbedTitle || null,
        noticeDenialEmbedColor: noticeDenialEmbedColor || null,
        noticeDenialEmbedDescription: noticeDenialEmbedDescription || null,
        noticeDenialEmbedFooter: noticeDenialEmbedFooter || null,
        // Session notification fields
        sessionChannelId: sessionChannelId || null,
        sessionChannelName: sessionChannelName || null,
        sessionNotifyOnCreate: sessionNotifyOnCreate || false,
        sessionNotifyOnClaim: sessionNotifyOnClaim || false,
        sessionNotifyOnStart: sessionNotifyOnStart || false,
        sessionEmbedTitle: sessionEmbedTitle || null,
        sessionEmbedColor: sessionEmbedColor || null,
        sessionEmbedDescription: sessionEmbedDescription || null,
        sessionEmbedFooter: sessionEmbedFooter || null,
        // Session review embed templates
        sessionReviewEmbedTitle: sessionReviewEmbedTitle || null,
        sessionReviewEmbedColor: sessionReviewEmbedColor || null,
        sessionReviewEmbedDescription: sessionReviewEmbedDescription || null,
        sessionReviewEmbedFooter: sessionReviewEmbedFooter || null,
        sessionPingRoleId: sessionPingRoleId || null,
        sessionPingRoleName: sessionPingRoleName || null,
        pingRoles: pingRoles || null,
        enabledEvents,
        isActive: true,
        lastMessageAt: new Date(),
      },
    });

    // Log the configuration action
    await logAudit(workspaceId, null, 'discord.integration.configure', 'discord', {
      guildId,
      channelId,
      enabledEvents,
    });

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
    console.error('[Discord] Configure error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to configure Discord integration'
    });
  }
}
