import prisma from './database';
import { BloxlinkAPI, decryptApiKey } from './bloxlink';
import { decryptToken } from './discord';
import { getRobloxThumbnail } from './roblox';

export async function sendSessionReviewNotification(params: {
  sessionId: string;
  userId: bigint;
  startTime: Date;
  endTime: Date;
  idleTime: number;
  messages: number;
  sessionMessage: string | null;
  workspaceGroupId: number;
}) {
  const { userId, startTime, endTime, idleTime, messages, sessionMessage, workspaceGroupId } = params;

  try {
    // Get Bloxlink integration
    const integration = await prisma.bloxlinkIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!integration || !integration.isActive || !integration.notifyActivityReview) {
      return;
    }

    // Get Discord integration for bot token
    const discordIntegration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!discordIntegration) {
      return;
    }

    // Get workspace name
    const workspace = await prisma.workspace.findUnique({
      where: { groupId: workspaceGroupId },
      select: { groupName: true },
    });

    if (!workspace) {
      return;
    }

    // Resolve Roblox ID -> Discord ID via Bloxlink
    const decryptedApiKey = decryptApiKey(integration.apiKey);
    const bloxlink = new BloxlinkAPI(decryptedApiKey, integration.discordServerId);
    const lookupResult = await bloxlink.lookupUserByRobloxId(Number(userId));

    if (!lookupResult.success || !lookupResult.user?.primaryDiscordID) {
      return;
    }

    // Get username
    let username = String(userId);
    const user = await prisma.user.findUnique({
      where: { userid: userId },
      select: { username: true },
    });
    if (user?.username) {
      username = user.username;
    }

    // Get thumbnail
    const thumbnail = await getRobloxThumbnail(userId);

    // Calculate stats
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.ceil(durationMs / 60000);
    const idleMinutes = Math.round(idleTime / 60);
    const activeMinutes = Math.max(0, durationMinutes - idleMinutes);

    const formatDuration = (mins: number) => {
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    // Variable replacement helper
    const replaceVariables = (template: string) => {
      return template
        .replace(/\{username\}/g, username)
        .replace(/\{workspace\}/g, workspace.groupName || 'Firefli')
        .replace(/\{duration\}/g, formatDuration(durationMinutes))
        .replace(/\{activeTime\}/g, formatDuration(activeMinutes))
        .replace(/\{idleTime\}/g, formatDuration(idleMinutes))
        .replace(/\{messages\}/g, String(messages))
        .replace(/\{sessionMessage\}/g, sessionMessage || 'Activity Session');
    };

    // Read custom embed templates
    const customTitle = discordIntegration.sessionReviewEmbedTitle;
    const customColor = discordIntegration.sessionReviewEmbedColor;
    const customDescription = discordIntegration.sessionReviewEmbedDescription;
    const customFooter = discordIntegration.sessionReviewEmbedFooter;

    // Build embed
    const embed: any = {
      title: customTitle ? replaceVariables(customTitle) : 'Session Complete',
      color: customColor ? parseInt(customColor.replace('#', ''), 16) : 0x5865F2,
      timestamp: endTime.toISOString(),
    };

    if (customDescription) {
      embed.description = replaceVariables(customDescription);
    } else {
      embed.description = sessionMessage || 'Activity Session';
      embed.fields = [
        { name: 'Duration', value: formatDuration(durationMinutes), inline: true },
        { name: 'Active Time', value: formatDuration(activeMinutes), inline: true },
        { name: 'Idle Time', value: formatDuration(idleMinutes), inline: true },
        { name: 'Messages Sent', value: String(messages), inline: true },
      ];
    }

    embed.footer = { text: customFooter ? replaceVariables(customFooter) : (workspace.groupName || 'Firefli') };

    if (thumbnail) {
      embed.thumbnail = { url: thumbnail };
    }

    // Send DM
    const discordBotToken = decryptToken(discordIntegration.botToken);

    const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${discordBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: lookupResult.user.primaryDiscordID,
      }),
    });

    if (!dmChannelResponse.ok) {
      throw new Error('Failed to create DM channel');
    }

    const dmChannel = await dmChannelResponse.json();

    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${discordBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!messageResponse.ok) {
      throw new Error('Failed to send DM');
    }

    // Update last used timestamp on success
    await prisma.bloxlinkIntegration.update({
      where: { workspaceGroupId },
      data: {
        lastUsed: new Date(),
        errorCount: 0,
        lastError: null,
      },
    });

    console.log(`[SessionReview] Notification sent to Discord user ${lookupResult.user.primaryDiscordID}`);
  } catch (error: any) {
    console.error('[SessionReview] Failed to send notification:', error);

    try {
      await prisma.bloxlinkIntegration.update({
        where: { workspaceGroupId },
        data: {
          errorCount: { increment: 1 },
          lastError: error.message || 'Unknown error',
        },
      });

      const updatedIntegration = await prisma.bloxlinkIntegration.findUnique({
        where: { workspaceGroupId },
      });

      if (updatedIntegration && updatedIntegration.errorCount >= 10) {
        await prisma.bloxlinkIntegration.update({
          where: { workspaceGroupId },
          data: { isActive: false },
        });
        console.warn(`[SessionReview] Disabled integration for workspace ${workspaceGroupId} due to excessive errors`);
      }
    } catch (updateError) {
      console.error('[SessionReview] Failed to update error count:', updateError);
    }
  }
}
