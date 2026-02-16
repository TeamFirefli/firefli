import crypto from 'crypto';
import axios from 'axios';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  return key;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
}

export interface DiscordMessage {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
  footer?: { text: string };
  thumbnail?: { url: string };
}

export class DiscordAPI {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', data?: any) {
    try {
      const response = await axios({
        method,
        url: `${DISCORD_API_BASE}${endpoint}`,
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        data,
        timeout: 10000,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid bot token');
      }
      if (error.response?.status === 403) {
        throw new Error('Bot lacks required permissions');
      }
      if (error.response?.status === 429) {
        throw new Error('Discord rate limit exceeded');
      }
      const discordError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Discord API error: ${discordError}`);
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.makeRequest('/users/@me');
      return true;
    } catch {
      return false;
    }
  }

  async getGuilds(): Promise<DiscordGuild[]> {
    const guilds = await this.makeRequest('/users/@me/guilds');

    return guilds.filter((guild: any) => {
      const permissions = BigInt(guild.permissions);
      const ADMINISTRATOR = 0x8n;
      const MANAGE_GUILD = 0x20n;

      return guild.owner || (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
    }).map((guild: any) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.owner,
      permissions: guild.permissions,
    }));
  }

  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    const channels = await this.makeRequest(`/guilds/${guildId}/channels`);

    return channels
      .filter((channel: any) => channel.type === 0)
      .sort((a: any, b: any) => a.position - b.position)
      .map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
      }));
  }

  async getGuildRoles(guildId: string): Promise<Array<{ id: string; name: string; color: number; position: number }>> {
    const roles = await this.makeRequest(`/guilds/${guildId}/roles`);

    return roles
      .filter((role: any) => role.name !== '@everyone')
      .sort((a: any, b: any) => b.position - a.position)
      .map((role: any) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      }));
  }

  private buildEmbed(message: DiscordMessage): any {
    const fields = (message.fields || []).filter(f => f.name && f.value);
    const embed: any = {
      title: (message.title || '').substring(0, 256) || undefined,
      description: (message.description || '').substring(0, 4096) || undefined,
      color: message.color || 0x5865F2,
      timestamp: message.timestamp || new Date().toISOString(),
      footer: message.footer || { text: 'Firefli Workspace' },
    };
    if (fields.length > 0) embed.fields = fields;
    if (message.thumbnail?.url && message.thumbnail.url.startsWith('http')) embed.thumbnail = message.thumbnail;
    return embed;
  }

  async sendMessage(channelId: string, message: DiscordMessage, content?: string): Promise<string | undefined> {
    const embed = this.buildEmbed(message);
    const payload: any = { embeds: [embed] };
    if (content) payload.content = content;
    const result = await this.makeRequest(`/channels/${channelId}/messages`, 'POST', payload);
    return result?.id;
  }

  async editMessage(channelId: string, messageId: string, message: DiscordMessage, content?: string): Promise<void> {
    const embed = this.buildEmbed(message);
    const payload: any = { embeds: [embed] };
    if (content !== undefined) payload.content = content;
    await this.makeRequest(`/channels/${channelId}/messages/${messageId}`, 'PATCH', payload);
  }

  async testConnection(channelId: string): Promise<boolean> {
    try {
      await this.sendMessage(channelId, {
        title: 'Discord Integration Connected!',
        description: 'Your Firefli workspace is now connected to Discord. You will receive notifications for workspace events here.',
        color: 0x00ff00,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Encryption utilities
export function encryptToken(token: string): string {
  const algorithm = 'aes-256-cbc';
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

export function decryptToken(encryptedToken: string): string {
  const algorithm = 'aes-256-cbc';
  const parts = encryptedToken.split(':');

  // Support legacy format (iv:encrypted) and new format (salt:iv:encrypted)
  let salt: Buffer, iv: Buffer, encrypted: string;
  if (parts.length === 3) {
    salt = Buffer.from(parts[0], 'hex');
    iv = Buffer.from(parts[1], 'hex');
    encrypted = parts[2];
  } else {
    // Legacy format: derive key with static salt for backwards compatibility
    salt = Buffer.from('salt');
    iv = Buffer.from(parts[0], 'hex');
    encrypted = parts[1];
  }

  const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function formatAuditEvent(
  action: string,
  userName: string,
  details: any,
  avatarUrl?: string,
  embedConfig?: {
    title?: string | null;
    color?: string | null;
    footer?: string | null;
    thumbnail?: boolean;
  }
): DiscordMessage {
  const actionLabels: Record<string, string> = {
    'userbook.create': 'User Action Logged',
    'notice.approve': 'Notice Approved',
    'notice.deny': 'Notice Denied',
    'notice.cancel': 'Notice Cancelled',
    'document.create': 'Document Created',
    'document.update': 'Document Updated',
    'document.delete': 'Document Deleted',
    'session.create': 'Session Created',
    'session.delete': 'Session Deleted',
    'wall.post.create': 'Wall Post Created',
    'wall.post.delete': 'Wall Post Deleted',
    'user.role.update': 'Role Updated',
    'workspace.settings.update': 'Settings Updated',
  };

  let title = embedConfig?.title || actionLabels[action] || action.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  if (embedConfig?.title) {
    title = title
      .replace('{action}', actionLabels[action] || action)
      .replace('{user}', userName)
      .replace('{username}', userName);
  }

  let description = `**${userName}** ${getActionDescription(action)}`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (details) {
    if (action.includes('document') && details.name) {
      fields.push({ name: 'Document', value: details.name, inline: true });
    }
    if (action.includes('session') && details.name) {
      fields.push({ name: 'Session', value: details.name, inline: true });
    }
    if (action.includes('wall.post') && details.content) {
      fields.push({
        name: 'Content',
        value: details.content.length > 500 ? details.content.substring(0, 500) + '...' : details.content,
        inline: false
      });
      if (details.hasImage) {
        fields.push({ name: 'Attachment', value: 'Image attached', inline: true });
      }
    }
    if (action.includes('role') && details.after && details.before) {
      const roleBefore = details.before.roles ? details.before.roles.join(', ') : 'None';
      const roleAfter = details.after.roles ? details.after.roles.join(', ') : 'None';
      fields.push(
        { name: 'Previous Roles', value: roleBefore, inline: false },
        { name: 'New Roles', value: roleAfter, inline: false }
      );
    }
    if (action === 'userbook.create') {
      const typeLabels: Record<string, string> = {
        warning: 'Warning',
        promotion: 'Promotion',
        demotion: 'Demotion',
        termination: 'Termination',
        note: 'Note',
        rank_change: 'Rank Change',
      };
      if (details.type) {
        fields.push({ name: 'Type', value: typeLabels[details.type] || details.type, inline: true });
      }
      if (details.targetUsername || details.userId) {
        fields.push({ name: 'Target User', value: details.targetUsername || String(details.userId), inline: true });
      }
      if (details.reason) {
        fields.push({ name: 'Reason', value: details.reason.length > 1024 ? details.reason.substring(0, 1024) + '...' : details.reason, inline: false });
      }
      if (details.rankNameBefore || details.rankNameAfter) {
        fields.push({
          name: 'Rank Change',
          value: `${details.rankNameBefore || 'N/A'} → ${details.rankNameAfter || 'N/A'}`,
          inline: false
        });
      }
    }
    if (action.startsWith('notice.')) {
      if (details.before?.reason) {
        fields.push({ name: 'Reason', value: details.before.reason, inline: false });
      }
    }
  }

  let color = 0x5865F2;
  if (embedConfig?.color) {
    const hexColor = embedConfig.color.replace('#', '');
    color = parseInt(hexColor, 16);
  } else {
    if (action === 'userbook.create' && details?.type) {
      const typeColors: Record<string, number> = {
        warning: 0xffa500,
        promotion: 0x00ff00,
        demotion: 0xff6600,
        termination: 0xff0000,
        note: 0x5865F2,
        rank_change: 0xffaa00,
      };
      color = typeColors[details.type] || 0x5865F2;
    } else if (action === 'notice.approve') {
      color = 0x00ff00;
    } else if (action === 'notice.deny') {
      color = 0xff0000;
    } else if (action.includes('delete') || action.includes('remove')) {
      color = 0xff0000;
    } else if (action.includes('create') || action.includes('add')) {
      color = 0x00ff00;
    } else if (action.includes('update') || action.includes('edit')) {
      color = 0xffaa00;
    }
  }

  let footerText = embedConfig?.footer || 'Firefli Workspace Logs';
  if (embedConfig?.footer) {
    footerText = footerText
      .replace('{user}', userName)
      .replace('{username}', userName)
      .replace('{action}', action);
  }

  const showThumbnail = (embedConfig?.thumbnail !== false) && avatarUrl;

  return {
    title,
    description,
    color,
    fields,
    footer: { text: footerText },
    thumbnail: showThumbnail ? { url: avatarUrl } : undefined,
  };
}

function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    'userbook.create': 'logged a user action',
    'notice.approve': 'approved an inactivity notice',
    'notice.deny': 'denied an inactivity notice',
    'notice.cancel': 'cancelled an inactivity notice',
    'document.create': 'created a document',
    'document.update': 'updated a document',
    'document.delete': 'deleted a document',
    'session.create': 'created a session',
    'session.delete': 'deleted a session',
    'wall.post.create': 'posted on the wall',
    'wall.post.delete': 'deleted a wall post',
    'user.role.update': 'had their roles updated',
    'workspace.settings.update': 'updated workspace settings',
  };

  return descriptions[action] || 'performed an action';
}

export async function sendWebhookEmbed(
  webhookUrl: string,
  embed: {
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    thumbnail?: { url: string };
    footer?: { text: string };
    timestamp?: string;
  }
): Promise<boolean> {
  try {
    await axios.post(webhookUrl, {
      embeds: [{
        ...embed,
        timestamp: embed.timestamp || new Date().toISOString(),
      }],
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    return true;
  } catch (error: any) {
    console.error('Failed to send Discord webhook:', error.message);
    return false;
  }
}

export default DiscordAPI;
