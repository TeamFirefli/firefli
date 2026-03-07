import prisma from './database';
import { BloxlinkAPI, decryptApiKey, formatNotificationMessage } from './bloxlink';
import DiscordAPI, { decryptToken } from './discord';
import { getUsername } from './userinfoEngine';

export async function sendBloxlinkNotification(
  workspaceGroupId: number,
  targetUserId: number,
  action: 'promotion' | 'demotion' | 'warning' | 'termination' | 'resignation',
  details: {
    reason?: string;
    issuedBy?: string;
    newRole?: string;
    rankBefore?: number | null;
    rankAfter?: number | null;
    rankNameBefore?: string | null;
    rankNameAfter?: string | null;
    terminationAction?: 'none' | 'kick' | 'ban';
    banDeleteDays?: number;
  }
) {
  try {
    // Get Bloxlink integration
    const integration = await prisma.bloxlinkIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!integration || !integration.isActive) {
      return; // No integration or not active
    }

    // Get Discord integration for embed templates and bot token
    const discordIntegration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!discordIntegration) {
      console.error('[Bloxlink] Discord integration not found for workspace:', workspaceGroupId);
      return;
    }

    // Check if this notification type is enabled
    const notificationEnabled = {
      promotion: integration.notifyPromotion,
      demotion: integration.notifyDemotion,
      warning: integration.notifyWarning,
      termination: integration.notifyDemotion,
      resignation: integration.notifyDemotion,
    };

    if (!notificationEnabled[action]) {
      return; // Notification type not enabled
    }

    // Get workspace name
    const workspace = await prisma.workspace.findUnique({
      where: { groupId: workspaceGroupId },
      select: { groupName: true }
    });

    if (!workspace) {
      console.error('[Bloxlink] Workspace not found:', workspaceGroupId);
      return;
    }

    // Get issuer username if provided
    let issuedByName = details.issuedBy || 'System';
    if (details.issuedBy) {
      try {
        const issuer = await prisma.user.findUnique({
          where: { userid: BigInt(details.issuedBy) },
          select: { username: true }
        });
        if (issuer?.username) {
          issuedByName = issuer.username;
        } else {
          issuedByName = await getUsername(BigInt(details.issuedBy)) || details.issuedBy;
        }
      } catch (e) {
        console.error('[Bloxlink] Failed to get issuer username:', e);
      }
    }

    // Initialize Bloxlink API
    const decryptedApiKey = decryptApiKey(integration.apiKey);
    const bloxlink = new BloxlinkAPI(decryptedApiKey, integration.discordServerId);

    // Lookup Discord user
    const lookupResult = await bloxlink.lookupUserByRobloxId(targetUserId);

    if (!lookupResult.success || !lookupResult.user?.primaryDiscordID) {
      console.log(`[Bloxlink] User ${targetUserId} not found in Discord server ${integration.discordServerId}`);
      return;
    }

    // Get target username - try database first, then Bloxlink resolved data, then Roblox API
    let targetUsername = String(targetUserId);
    const targetUser = await prisma.user.findUnique({
      where: { userid: BigInt(targetUserId) },
      select: { username: true }
    });
    if (targetUser?.username) {
      targetUsername = targetUser.username;
    } else if (lookupResult.user.resolved?.roblox?.username && lookupResult.user.resolved.roblox.username !== 'Unknown') {
      targetUsername = lookupResult.user.resolved.roblox.username;
    } else {
      try {
        const robloxUsername = await getUsername(targetUserId);
        if (robloxUsername) targetUsername = robloxUsername;
      } catch (e) {
        // Fall back to userId string
      }
    }

    // Helper function to replace template variables
    const replaceVariables = (template: string) => {
      return template
        .replace(/\{username\}/g, targetUsername)
        .replace(/\{userId\}/g, String(targetUserId))
        .replace(/\{workspace\}/g, workspace.groupName || 'Workspace')
        .replace(/\{reason\}/g, details.reason || 'No reason provided')
        .replace(/\{issuedBy\}/g, issuedByName)
        .replace(/\{newRole\}/g, details.rankNameAfter || 'Unknown')
        .replace(/\{previousRole\}/g, details.rankNameBefore || 'Unknown')
        .replace(/\{rankChange\}/g, details.rankNameBefore && details.rankNameAfter && details.rankNameBefore !== details.rankNameAfter
          ? `${details.rankNameBefore} → ${details.rankNameAfter}`
          : 'No rank change');
    };

    // Get custom templates for this action
    const customTitle = {
      promotion: discordIntegration.promotionEmbedTitle,
      demotion: discordIntegration.demotionEmbedTitle,
      warning: discordIntegration.warningEmbedTitle,
      termination: discordIntegration.terminationEmbedTitle,
      resignation: discordIntegration.resignationEmbedTitle
    };

    const customColor = {
      promotion: discordIntegration.promotionEmbedColor,
      demotion: discordIntegration.demotionEmbedColor,
      warning: discordIntegration.warningEmbedColor,
      termination: discordIntegration.terminationEmbedColor,
      resignation: discordIntegration.resignationEmbedColor
    };

    const customDescription = {
      promotion: discordIntegration.promotionEmbedDescription,
      demotion: discordIntegration.demotionEmbedDescription,
      warning: discordIntegration.warningEmbedDescription,
      termination: discordIntegration.terminationEmbedDescription,
      resignation: discordIntegration.resignationEmbedDescription
    };

    const customFooter = {
      promotion: discordIntegration.promotionEmbedFooter,
      demotion: discordIntegration.demotionEmbedFooter,
      warning: discordIntegration.warningEmbedFooter,
      termination: discordIntegration.terminationEmbedFooter,
      resignation: discordIntegration.resignationEmbedFooter
    };

    // Default values if no custom templates
    const defaultEmoji = {
      promotion: '📈',
      demotion: '📉',
      warning: '⚠️',
      termination: '🚫',
      resignation: '💼'
    };

    const defaultColor = {
      promotion: 0x00ff00, // Green
      demotion: 0xff9900,  // Orange
      warning: 0xff0000,   // Red
      termination: 0x8b0000, // Dark red
      resignation: 0x0000ff  // Blue
    };

    const defaultTitle = `${defaultEmoji[action]} ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    const defaultDescriptionText = `You have received a ${action} in **{workspace}**`;

    // Build the embed
    const embed = {
      title: customTitle[action] ? replaceVariables(customTitle[action]) : defaultTitle,
      description: customDescription[action] ? replaceVariables(customDescription[action]) : replaceVariables(defaultDescriptionText),
      color: customColor[action] ? parseInt(customColor[action].replace('#', ''), 16) : defaultColor[action],
      timestamp: new Date().toISOString(),
      footer: {
        text: customFooter[action] ? replaceVariables(customFooter[action]) : (workspace.groupName || 'Firefli')
      },
      fields: [] as any[]
    };

    // Add default fields when no custom description is set
    if (!customDescription[action]) {
      if (details.reason) {
        embed.fields.push({ name: 'Reason', value: details.reason, inline: false });
      }
      if (details.rankNameBefore && details.rankNameAfter && details.rankNameBefore !== details.rankNameAfter) {
        embed.fields.push({ name: 'Rank Change', value: `${details.rankNameBefore} → ${details.rankNameAfter}`, inline: false });
      }
      if (issuedByName && issuedByName !== 'System') {
        embed.fields.push({ name: 'Issued By', value: issuedByName, inline: true });
      }
    }

    // Send DM using Discord API
    const discordBotToken = decryptToken(discordIntegration.botToken);

    // Create DM channel and send message FIRST (before kick/ban)
    try {
      const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${discordBotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: lookupResult.user.primaryDiscordID
        })
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
          embeds: [embed]
        })
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

      console.log(`[Bloxlink] Notification sent to Discord user ${lookupResult.user.primaryDiscordID} for ${action}`);

      // NOW handle termination actions (kick/ban) AFTER successful DM
      if (action === 'termination' && details.terminationAction && details.terminationAction !== 'none') {
        try {
          if (details.terminationAction === 'kick') {
            // Kick user from Discord server
            const kickResponse = await fetch(`https://discord.com/api/v10/guilds/${integration.discordServerId}/members/${lookupResult.user.primaryDiscordID}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bot ${discordBotToken}`,
                'X-Audit-Log-Reason': `Terminated from ${workspace.groupName}: ${details.reason || 'No reason provided'}`
              }
            });

            if (!kickResponse.ok) {
              console.warn(`[Bloxlink] Failed to kick user ${lookupResult.user.primaryDiscordID}: ${kickResponse.statusText}`);
            } else {
              console.log(`[Bloxlink] Successfully kicked user ${lookupResult.user.primaryDiscordID} from Discord server`);
            }
          } else if (details.terminationAction === 'ban') {
            // Ban user from Discord server
            const banResponse = await fetch(`https://discord.com/api/v10/guilds/${integration.discordServerId}/bans/${lookupResult.user.primaryDiscordID}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bot ${discordBotToken}`,
                'Content-Type': 'application/json',
                'X-Audit-Log-Reason': `Terminated from ${workspace.groupName}: ${details.reason || 'No reason provided'}`
              },
              body: JSON.stringify({
                delete_message_days: details.banDeleteDays || 0
              })
            });

            if (!banResponse.ok) {
              console.warn(`[Bloxlink] Failed to ban user ${lookupResult.user.primaryDiscordID}: ${banResponse.statusText}`);
            } else {
              console.log(`[Bloxlink] Successfully banned user ${lookupResult.user.primaryDiscordID} from Discord server`);
            }
          }
        } catch (actionError: any) {
          console.warn(`[Bloxlink] Failed to perform ${details.terminationAction} action:`, actionError.message);
          // Don't throw here - DM was already sent successfully
        }
      }
    } catch (dmError: any) {
      throw new Error(`Failed to send Discord DM: ${dmError.message}`);
    }
  } catch (error: any) {
    console.error(`[Bloxlink] Failed to send ${action} notification:`, error);

    // Update error information
    try {
      await prisma.bloxlinkIntegration.update({
        where: { workspaceGroupId },
        data: {
          errorCount: { increment: 1 },
          lastError: error.message || 'Unknown error',
        },
      });

      // Disable integration if too many errors
      const updatedIntegration = await prisma.bloxlinkIntegration.findUnique({
        where: { workspaceGroupId },
      });

      if (updatedIntegration && updatedIntegration.errorCount >= 10) {
        await prisma.bloxlinkIntegration.update({
          where: { workspaceGroupId },
          data: { isActive: false },
        });
        console.warn(`[Bloxlink] Disabled integration for workspace ${workspaceGroupId} due to excessive errors`);
      }
    } catch (updateError) {
      console.error('[Bloxlink] Failed to update error count:', updateError);
    }
  }
}
