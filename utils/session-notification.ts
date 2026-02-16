import prisma from './database';
import { DiscordAPI, decryptToken, DiscordMessage } from './discord';
import { getUsername } from './userinfoEngine';

interface SessionDetails {
  id: string;
  name: string;
  type: string;
  date: Date;
  duration: number;
  hostUserId: number | null;
  sessionTypeName?: string;
}

async function resolveHostName(hostUserId: number | null): Promise<string> {
  if (!hostUserId) return 'Unassigned';
  try {
    const hostUser = await prisma.user.findUnique({
      where: { userid: BigInt(hostUserId) },
      select: { username: true },
    });
    if (hostUser?.username) return hostUser.username;
    return await getUsername(hostUserId) || String(hostUserId);
  } catch {
    return String(hostUserId);
  }
}

export function getSessionStatus(
  date: Date,
  duration: number,
  statues: any[],
  ended?: Date | null,
): string | null {
  const now = new Date();
  const endTime = new Date(new Date(date).getTime() + duration * 60 * 1000);

  if (ended || now > endTime) return 'Concluded';

  const minutesFromStart = (now.getTime() - new Date(date).getTime()) / 1000 / 60;
  if (minutesFromStart < 0) return null;

  const sorted = [...statues].sort((a: any, b: any) => b.timeAfter - a.timeAfter);
  for (const status of sorted) {
    if (minutesFromStart >= status.timeAfter) {
      return status.name;
    }
  }
  return null;
}

function buildSessionEmbed(
  integration: any,
  sessionDetails: SessionDetails,
  hostName: string,
  workspaceName: string,
  status?: string | null,
  trigger?: 'create' | 'claim' | 'start',
): DiscordMessage {
  const dateStr = sessionDetails.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const replaceVariables = (template: string) => {
    return template
      .replace(/\{sessionName\}/g, sessionDetails.name || 'Unnamed Session')
      .replace(/\{host\}/g, hostName)
      .replace(/\{date\}/g, dateStr)
      .replace(/\{type\}/g, sessionDetails.type || 'other')
      .replace(/\{duration\}/g, String(sessionDetails.duration || 30))
      .replace(/\{sessionTypeName\}/g, sessionDetails.sessionTypeName || sessionDetails.type || 'Session')
      .replace(/\{workspace\}/g, workspaceName);
  };

  const concluded = status === 'Concluded';
  const defaultColor = 0x3b82f6;
  const concludedColor = 0x71717a;
  
  let embedTitle: string | null = null;
  let embedColor: string | null = null;
  let embedDescription: string | null = null;
  let embedFooter: string | null = null;
  let triggerColor = defaultColor;
  let triggerPrefix = '';
  
  if (trigger === 'create') {
    embedTitle = integration.sessionCreateEmbedTitle;
    embedColor = integration.sessionCreateEmbedColor;
    embedDescription = integration.sessionCreateEmbedDescription;
    embedFooter = integration.sessionCreateEmbedFooter;
    triggerColor = 0x10b981;
    triggerPrefix = '📝 ';
  } else if (trigger === 'claim') {
    embedTitle = integration.sessionClaimEmbedTitle;
    embedColor = integration.sessionClaimEmbedColor;
    embedDescription = integration.sessionClaimEmbedDescription;
    embedFooter = integration.sessionClaimEmbedFooter;
    triggerColor = 0xf59e0b;
    triggerPrefix = '✋ ';
  } else if (trigger === 'start') {
    embedTitle = integration.sessionStartEmbedTitle;
    embedColor = integration.sessionStartEmbedColor;
    embedDescription = integration.sessionStartEmbedDescription;
    embedFooter = integration.sessionStartEmbedFooter;
    triggerColor = 0x3b82f6;
    triggerPrefix = '🎯 ';
  }
  
  if (!embedTitle) embedTitle = integration.sessionEmbedTitle;
  if (!embedColor) embedColor = integration.sessionEmbedColor;
  if (!embedDescription) embedDescription = integration.sessionEmbedDescription;
  if (!embedFooter) embedFooter = integration.sessionEmbedFooter;

  const title = embedTitle
    ? replaceVariables(embedTitle)
    : sessionDetails.name || 'Session';

  const description = embedDescription
    ? replaceVariables(embedDescription)
    : '';

  const color = concluded
    ? concludedColor
    : embedColor
      ? parseInt(embedColor.replace('#', ''), 16)
      : triggerColor;

  const footer = embedFooter
    ? replaceVariables(embedFooter)
    : `${workspaceName} \u2022 Session Notifications`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  if (!embedDescription) {
    const typeLabel = (sessionDetails.type || 'other').charAt(0).toUpperCase() + (sessionDetails.type || 'other').slice(1);
    
    if (trigger === 'create') {
      fields.push({ name: 'Type', value: typeLabel, inline: true });
      fields.push({ name: 'Scheduled For', value: dateStr, inline: true });
      fields.push({ name: 'Duration', value: `${sessionDetails.duration || 30} minutes`, inline: true });
      fields.push({ name: 'Host', value: hostName, inline: true });
    } else if (trigger === 'claim') {
      fields.push({ name: 'Type', value: typeLabel, inline: true });
      fields.push({ name: 'Claimed By', value: hostName, inline: true });
      fields.push({ name: 'Scheduled For', value: dateStr, inline: true });
      fields.push({ name: 'Duration', value: `${sessionDetails.duration || 30} minutes`, inline: true });
    } else if (trigger === 'start') {
      fields.push({ name: 'Type', value: typeLabel, inline: true });
      fields.push({ name: 'Started At', value: dateStr, inline: true });
      fields.push({ name: 'Duration', value: `${sessionDetails.duration || 30} minutes`, inline: true });
      fields.push({ name: 'Host', value: hostName, inline: true });
    } else {
      fields.push({ name: 'Type', value: typeLabel, inline: true });
      fields.push({ name: 'Date', value: dateStr, inline: true });
      fields.push({ name: 'Duration', value: `${sessionDetails.duration || 30} minutes`, inline: true });
      fields.push({ name: 'Host', value: hostName, inline: true });
      if (status) {
        fields.push({ name: 'Status', value: status, inline: true });
      }
    }
  }

  let displayTitle = concluded 
    ? `${title} - Concluded` 
    : status 
      ? `${title} - ${status}` 
      : title;
  
  if (trigger && !concluded && !status) {
    displayTitle = `${triggerPrefix}${displayTitle}`;
  }

  return { title: displayTitle, description: description || undefined, color, fields, footer: { text: footer } };
}

export async function sendSessionNotification(
  workspaceGroupId: number,
  trigger: 'create' | 'claim' | 'start',
  sessionDetails: SessionDetails
) {
  try {
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!integration || !integration.isActive) return;

    if (trigger === 'create' && !integration.sessionNotifyOnCreate) return;
    if (trigger === 'claim' && !integration.sessionNotifyOnClaim) return;
    if (trigger === 'start' && !integration.sessionNotifyOnStart) return;

    const channelId = integration.sessionChannelId || integration.channelId;
    const hostName = await resolveHostName(sessionDetails.hostUserId);

    const workspace = await prisma.workspace.findUnique({
      where: { groupId: workspaceGroupId },
      select: { groupName: true },
    });
    const workspaceName = workspace?.groupName || 'Workspace';

    const embed = buildSessionEmbed(integration, sessionDetails, hostName, workspaceName, undefined, trigger);

    const discordBotToken = decryptToken(integration.botToken);
    const discord = new DiscordAPI(discordBotToken);

    const pingContent = integration.sessionPingRoleId
      ? `<@&${integration.sessionPingRoleId}>`
      : undefined;

    const messageId = await discord.sendMessage(channelId, embed, pingContent);

    // Store message ID on session for later editing
    if (messageId) {
      await prisma.session.update({
        where: { id: sessionDetails.id },
        data: {
          discordMessageId: messageId,
          discordChannelId: channelId,
        },
      }).catch(() => {});
    }

    await prisma.discordIntegration.update({
      where: { workspaceGroupId },
      data: {
        lastMessageAt: new Date(),
        errorCount: 0,
        lastError: null,
      },
    });
  } catch (error: any) {
    console.error(`[SessionNotification] Failed to send ${trigger} notification:`, error);
    try {
      await prisma.discordIntegration.update({
        where: { workspaceGroupId },
        data: {
          errorCount: { increment: 1 },
          lastError: error.message || String(error),
        },
      });
    } catch {}
  }
}

export async function editSessionNotification(sessionId: string, status?: string) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { sessionType: true },
    });

    if (!session || !session.discordMessageId || !session.discordChannelId) return;

    const workspaceGroupId = session.sessionType.workspaceGroupId;

    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!integration || !integration.isActive) return;

    const currentStatus = status ?? getSessionStatus(
      session.date,
      session.duration,
      (session.sessionType as any).statues || [],
      session.ended,
    );

    const hostName = await resolveHostName(session.ownerId ? Number(session.ownerId) : null);

    const workspace = await prisma.workspace.findUnique({
      where: { groupId: workspaceGroupId },
      select: { groupName: true },
    });
    const workspaceName = workspace?.groupName || 'Workspace';

    const embed = buildSessionEmbed(
      integration,
      {
        id: session.id,
        name: session.name || '',
        type: session.type || 'other',
        date: session.date,
        duration: session.duration,
        hostUserId: session.ownerId ? Number(session.ownerId) : null,
        sessionTypeName: session.sessionType.name,
      },
      hostName,
      workspaceName,
      currentStatus,
    );

    const discordBotToken = decryptToken(integration.botToken);
    const discord = new DiscordAPI(discordBotToken);

    await discord.editMessage(session.discordChannelId, session.discordMessageId, embed);

    await prisma.session.update({
      where: { id: sessionId },
      data: { lastDiscordStatus: currentStatus },
    }).catch(() => {});

    await prisma.discordIntegration.update({
      where: { workspaceGroupId },
      data: {
        lastMessageAt: new Date(),
        errorCount: 0,
        lastError: null,
      },
    });
  } catch (error: any) {
    console.error(`[SessionNotification] Failed to edit notification for session ${sessionId}:`, error);
  }
}
