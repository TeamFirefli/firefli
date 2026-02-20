import axios from 'axios';
import { useEffect, useState } from 'react';
import { workspacestate } from '@/state';
import { useRecoilState } from 'recoil';
import { IconCheck, IconX, IconRefresh, IconTrash, IconBrandDiscord, IconSettings, IconPalette, IconBell, IconTrendingUp, IconTrendingDown, IconAlertTriangle, IconBan, IconCake, IconFileText, IconCircleCheck, IconCircleX, IconCalendarEvent, IconClipboardCheck } from '@tabler/icons-react';
import { FC } from '@/types/settingsComponent';

type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
};

type DiscordChannel = {
  id: string;
  name: string;
  position: number;
};

type DiscordIntegration = {
  id: string;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  birthdayChannelId: string | null;
  birthdayChannelName: string | null;
  birthdayEnabled: boolean;
  embedTitle: string | null;
  embedColor: string | null;
  embedFooter: string | null;
  embedThumbnail: boolean;
  enabledEvents: string[];
  isActive: boolean;
  lastMessageAt: string | null;
  errorCount: number;
  lastError: string | null;
  // New embed template fields
  promotionEmbedTitle?: string | null;
  promotionEmbedColor?: string | null;
  promotionEmbedDescription?: string | null;
  promotionEmbedFooter?: string | null;
  demotionEmbedTitle?: string | null;
  demotionEmbedColor?: string | null;
  demotionEmbedDescription?: string | null;
  demotionEmbedFooter?: string | null;
  warningEmbedTitle?: string | null;
  warningEmbedColor?: string | null;
  warningEmbedDescription?: string | null;
  warningEmbedFooter?: string | null;
  terminationEmbedTitle?: string | null;
  terminationEmbedColor?: string | null;
  terminationEmbedDescription?: string | null;
  terminationEmbedFooter?: string | null;
  birthdayEmbedTitle?: string | null;
  birthdayEmbedColor?: string | null;
  birthdayEmbedDescription?: string | null;
  // Notice embed templates
  noticeSubmitEmbedTitle?: string | null;
  noticeSubmitEmbedColor?: string | null;
  noticeSubmitEmbedDescription?: string | null;
  noticeSubmitEmbedFooter?: string | null;
  noticeApprovalEmbedTitle?: string | null;
  noticeApprovalEmbedColor?: string | null;
  noticeApprovalEmbedDescription?: string | null;
  noticeApprovalEmbedFooter?: string | null;
  noticeDenialEmbedTitle?: string | null;
  noticeDenialEmbedColor?: string | null;
  noticeDenialEmbedDescription?: string | null;
  noticeDenialEmbedFooter?: string | null;
  // Session notification fields
  sessionChannelId?: string | null;
  sessionChannelName?: string | null;
  sessionNotifyOnCreate?: boolean;
  sessionNotifyOnClaim?: boolean;
  sessionNotifyOnStart?: boolean;
  sessionEmbedTitle?: string | null;
  sessionEmbedColor?: string | null;
  sessionEmbedDescription?: string | null;
  sessionEmbedFooter?: string | null;
  sessionCreateEmbedTitle?: string | null;
  sessionCreateEmbedColor?: string | null;
  sessionCreateEmbedDescription?: string | null;
  sessionCreateEmbedFooter?: string | null;
  sessionClaimEmbedTitle?: string | null;
  sessionClaimEmbedColor?: string | null;
  sessionClaimEmbedDescription?: string | null;
  sessionClaimEmbedFooter?: string | null;
  sessionStartEmbedTitle?: string | null;
  sessionStartEmbedColor?: string | null;
  sessionStartEmbedDescription?: string | null;
  sessionStartEmbedFooter?: string | null;
  // Session review embed templates
  sessionReviewEmbedTitle?: string | null;
  sessionReviewEmbedColor?: string | null;
  sessionReviewEmbedDescription?: string | null;
  sessionReviewEmbedFooter?: string | null;
  sessionPingRoleId?: string | null;
  sessionPingRoleName?: string | null;
  pingRoles?: Record<string, string> | null;
};

const EVENT_TYPES = [
  { id: 'userbook.create', label: 'User Actions', description: 'Warnings, promotions, demotions, and terminations' },
  { id: 'notice.approve', label: 'Notice Approved', description: 'When inactivity notices are approved' },
  { id: 'notice.deny', label: 'Notice Denied', description: 'When inactivity notices are denied' },
  { id: 'document.create', label: 'Document Created', description: 'When new documents are created' },
  { id: 'document.update', label: 'Document Updated', description: 'When documents are edited' },
  { id: 'document.delete', label: 'Document Deleted', description: 'When documents are removed' },
  { id: 'session.create', label: 'Session Created', description: 'When new training sessions are created' },
  { id: 'session.delete', label: 'Session Deleted', description: 'When training sessions are removed' },
  { id: 'wall.post.create', label: 'Wall Post Created', description: 'When new wall posts are made' },
  { id: 'wall.post.delete', label: 'Wall Post Deleted', description: 'When wall posts are removed' },
  { id: 'user.role.update', label: 'Role Updates', description: 'When user roles are changed' },
];

const DiscordIntegration: FC<{ triggerToast?: any }> = ({ triggerToast }) => {
  const [workspace] = useRecoilState(workspacestate);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'configuration' | 'embeds'>('configuration');
  const [step, setStep] = useState(1); // 1: token, 2: guild, 3: channel, 4: events
  const [botToken, setBotToken] = useState('');
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [birthdayChannelId, setBirthdayChannelId] = useState<string>('');
  const [birthdayEnabled, setBirthdayEnabled] = useState<boolean>(false);
  const [enabledEvents, setEnabledEvents] = useState<string[]>([]);
  const [integration, setIntegration] = useState<DiscordIntegration | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [embedCategory, setEmbedCategory] = useState<string>('general');

  // Edit mode states for the toggleable interface
  const [editEnabledEvents, setEditEnabledEvents] = useState<string[]>([]);
  const [editBirthdayEnabled, setEditBirthdayEnabled] = useState<boolean>(false);
  const [editEmbedTitle, setEditEmbedTitle] = useState<string>('');
  const [editEmbedColor, setEditEmbedColor] = useState<string>('');
  const [editEmbedFooter, setEditEmbedFooter] = useState<string>('');
  const [editEmbedThumbnail, setEditEmbedThumbnail] = useState<boolean>(true);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // User action embed states
  const [editPromotionEmbedTitle, setEditPromotionEmbedTitle] = useState<string>('');
  const [editPromotionEmbedColor, setEditPromotionEmbedColor] = useState<string>('');
  const [editPromotionEmbedDescription, setEditPromotionEmbedDescription] = useState<string>('');
  const [editPromotionEmbedFooter, setEditPromotionEmbedFooter] = useState<string>('');

  const [editDemotionEmbedTitle, setEditDemotionEmbedTitle] = useState<string>('');
  const [editDemotionEmbedColor, setEditDemotionEmbedColor] = useState<string>('');
  const [editDemotionEmbedDescription, setEditDemotionEmbedDescription] = useState<string>('');
  const [editDemotionEmbedFooter, setEditDemotionEmbedFooter] = useState<string>('');

  const [editWarningEmbedTitle, setEditWarningEmbedTitle] = useState<string>('');
  const [editWarningEmbedColor, setEditWarningEmbedColor] = useState<string>('');
  const [editWarningEmbedDescription, setEditWarningEmbedDescription] = useState<string>('');
  const [editWarningEmbedFooter, setEditWarningEmbedFooter] = useState<string>('');

  const [editTerminationEmbedTitle, setEditTerminationEmbedTitle] = useState<string>('');
  const [editTerminationEmbedColor, setEditTerminationEmbedColor] = useState<string>('');
  const [editTerminationEmbedDescription, setEditTerminationEmbedDescription] = useState<string>('');
  const [editTerminationEmbedFooter, setEditTerminationEmbedFooter] = useState<string>('');

  // Birthday embed states
  const [editBirthdayEmbedTitle, setEditBirthdayEmbedTitle] = useState<string>('');
  const [editBirthdayEmbedColor, setEditBirthdayEmbedColor] = useState<string>('');
  const [editBirthdayEmbedDescription, setEditBirthdayEmbedDescription] = useState<string>('');

  // Notice embed states
  const [editNoticeSubmitEmbedTitle, setEditNoticeSubmitEmbedTitle] = useState<string>('');
  const [editNoticeSubmitEmbedColor, setEditNoticeSubmitEmbedColor] = useState<string>('');
  const [editNoticeSubmitEmbedDescription, setEditNoticeSubmitEmbedDescription] = useState<string>('');
  const [editNoticeSubmitEmbedFooter, setEditNoticeSubmitEmbedFooter] = useState<string>('');

  const [editNoticeApprovalEmbedTitle, setEditNoticeApprovalEmbedTitle] = useState<string>('');
  const [editNoticeApprovalEmbedColor, setEditNoticeApprovalEmbedColor] = useState<string>('');
  const [editNoticeApprovalEmbedDescription, setEditNoticeApprovalEmbedDescription] = useState<string>('');
  const [editNoticeApprovalEmbedFooter, setEditNoticeApprovalEmbedFooter] = useState<string>('');

  const [editNoticeDenialEmbedTitle, setEditNoticeDenialEmbedTitle] = useState<string>('');
  const [editNoticeDenialEmbedColor, setEditNoticeDenialEmbedColor] = useState<string>('');
  const [editNoticeDenialEmbedDescription, setEditNoticeDenialEmbedDescription] = useState<string>('');
  const [editNoticeDenialEmbedFooter, setEditNoticeDenialEmbedFooter] = useState<string>('');

  // Session notification states
  const [editSessionNotifyOnCreate, setEditSessionNotifyOnCreate] = useState<boolean>(false);
  const [editSessionNotifyOnClaim, setEditSessionNotifyOnClaim] = useState<boolean>(false);
  const [editSessionNotifyOnStart, setEditSessionNotifyOnStart] = useState<boolean>(false);
  const [editSessionChannelId, setEditSessionChannelId] = useState<string>('');
  const [sessionChannels, setSessionChannels] = useState<DiscordChannel[]>([]);
  const [discordRoles, setDiscordRoles] = useState<Array<{ id: string; name: string; color: number; position: number }>>([]);
  const [loadingSessionChannels, setLoadingSessionChannels] = useState<boolean>(false);
  const [editPingRoles, setEditPingRoles] = useState<Record<string, string>>({});
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  // Session embed states
  const [editSessionEmbedTitle, setEditSessionEmbedTitle] = useState<string>('');
  const [editSessionEmbedColor, setEditSessionEmbedColor] = useState<string>('');
  const [editSessionEmbedDescription, setEditSessionEmbedDescription] = useState<string>('');
  const [editSessionEmbedFooter, setEditSessionEmbedFooter] = useState<string>('');

  // Session Create embed states
  const [editSessionCreateEmbedTitle, setEditSessionCreateEmbedTitle] = useState<string>('');
  const [editSessionCreateEmbedColor, setEditSessionCreateEmbedColor] = useState<string>('');
  const [editSessionCreateEmbedDescription, setEditSessionCreateEmbedDescription] = useState<string>('');
  const [editSessionCreateEmbedFooter, setEditSessionCreateEmbedFooter] = useState<string>('');

  // Session Claim embed states
  const [editSessionClaimEmbedTitle, setEditSessionClaimEmbedTitle] = useState<string>('');
  const [editSessionClaimEmbedColor, setEditSessionClaimEmbedColor] = useState<string>('');
  const [editSessionClaimEmbedDescription, setEditSessionClaimEmbedDescription] = useState<string>('');
  const [editSessionClaimEmbedFooter, setEditSessionClaimEmbedFooter] = useState<string>('');

  // Session Start embed states
  const [editSessionStartEmbedTitle, setEditSessionStartEmbedTitle] = useState<string>('');
  const [editSessionStartEmbedColor, setEditSessionStartEmbedColor] = useState<string>('');
  const [editSessionStartEmbedDescription, setEditSessionStartEmbedDescription] = useState<string>('');
  const [editSessionStartEmbedFooter, setEditSessionStartEmbedFooter] = useState<string>('');

  // Session review embed states
  const [editSessionReviewEmbedTitle, setEditSessionReviewEmbedTitle] = useState<string>('');
  const [editSessionReviewEmbedColor, setEditSessionReviewEmbedColor] = useState<string>('');
  const [editSessionReviewEmbedDescription, setEditSessionReviewEmbedDescription] = useState<string>('');
  const [editSessionReviewEmbedFooter, setEditSessionReviewEmbedFooter] = useState<string>('');


  // Role mention autocomplete
  const [showRoleMention, setShowRoleMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState<number>(0);

  const fetchSessionChannels = async () => {
    if (!integration || sessionChannels.length > 0) return;
    setLoadingSessionChannels(true);
    try {
      const res = await axios.get(`/api/workspace/${workspace.groupId}/settings/discord/integration-channels`);
      if (res.data?.success) {
        setSessionChannels(res.data.channels);
        if (res.data.roles) setDiscordRoles(res.data.roles);
      }
    } catch (e) {
      console.error('Failed to fetch session channels:', e);
    } finally {
      setLoadingSessionChannels(false);
    }
  };

  const fetchIntegrationStatus = async () => {
    try {
      const res = await axios.get(`/api/workspace/${workspace.groupId}/settings/discord/status`);
      if (res.data?.success) {
        setIntegration(res.data.integration);
      }
    } catch (e) {
      console.error('Failed to fetch Discord integration status:', e);
    }
  };

  const validateToken = async () => {
    if (!botToken.trim()) {
      triggerToast?.error('Please enter a bot token');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`/api/workspace/${workspace.groupId}/settings/discord/setup`, {
        botToken: botToken.trim()
      });

      if (res.data?.success) {
        setGuilds(res.data.guilds);
        setStep(2);
        triggerToast?.success('Bot token validated successfully!');
      } else {
        triggerToast?.error(res.data?.error || 'Failed to validate bot token');
      }
    } catch (e: any) {
      triggerToast?.error(e.response?.data?.error || 'Failed to validate bot token');
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async (guildId: string) => {
    setLoading(true);
    try {
      const res = await axios.post(`/api/workspace/${workspace.groupId}/settings/discord/channels`, {
        botToken: botToken.trim(),
        guildId
      });

      if (res.data?.success) {
        setChannels(res.data.channels);
        setSelectedGuild(guildId);
        setStep(3);
      } else {
        triggerToast?.error(res.data?.error || 'Failed to fetch channels');
      }
    } catch (e: any) {
      triggerToast?.error(e.response?.data?.error || 'Failed to fetch channels');
    } finally {
      setLoading(false);
    }
  };

  const saveIntegration = async () => {
    if (!selectedChannel) {
      triggerToast?.error('Please select a channel');
      return;
    }

    if (enabledEvents.length === 0) {
      triggerToast?.error('Please select at least one event type');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`/api/workspace/${workspace.groupId}/settings/discord/configure`, {
        botToken: botToken.trim(),
        guildId: selectedGuild,
        channelId: selectedChannel,
        enabledEvents,
        guildName: guilds.find(g => g.id === selectedGuild)?.name || '',
        channelName: channels.find(c => c.id === selectedChannel)?.name || '',
        birthdayChannelId: birthdayChannelId || null,
        birthdayChannelName: birthdayChannelId ? channels.find(c => c.id === birthdayChannelId)?.name || null : null,
        birthdayEnabled
      });

      if (res.data?.success) {
        setIntegration(res.data.integration);
        resetForm();
        triggerToast?.success('Discord integration configured successfully! A test message was sent to the channel.');
      } else {
        triggerToast?.error(res.data?.error || 'Failed to configure Discord integration');
      }
    } catch (e: any) {
      triggerToast?.error(e.response?.data?.error || 'Failed to configure Discord integration');
    } finally {
      setLoading(false);
    }
  };

  const removeIntegration = async () => {
    setLoading(true);
    try {
      const res = await axios.delete(`/api/workspace/${workspace.groupId}/settings/discord/remove`);

      if (res.data?.success) {
        setIntegration(null);
        setShowRemoveModal(false);
        triggerToast?.success('Discord integration removed successfully');
      } else {
        triggerToast?.error(res.data?.error || 'Failed to remove Discord integration');
      }
    } catch (e: any) {
      triggerToast?.error(e.response?.data?.error || 'Failed to remove Discord integration');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setBotToken('');
    setGuilds([]);
    setSelectedGuild('');
    setChannels([]);
    setSelectedChannel('');
    setBirthdayChannelId('');
    setBirthdayEnabled(false);
    setEnabledEvents([]);
    setEditMode(false);
  };

  const toggleEditEvent = (eventId: string) => {
    const newEvents = editEnabledEvents.includes(eventId)
      ? editEnabledEvents.filter(e => e !== eventId)
      : [...editEnabledEvents, eventId];
    setEditEnabledEvents(newEvents);
    checkForChanges(newEvents, editBirthdayEnabled);
  };

  const toggleEditBirthday = () => {
    const newBirthdayEnabled = !editBirthdayEnabled;
    setEditBirthdayEnabled(newBirthdayEnabled);
    checkForChanges(editEnabledEvents, newBirthdayEnabled);
  };

  const handleEmbedTitleChange = (title: string) => {
    setEditEmbedTitle(title);
    checkForChanges(editEnabledEvents, editBirthdayEnabled, title);
  };

  const handleEmbedColorChange = (color: string) => {
    setEditEmbedColor(color);
    checkForChanges(editEnabledEvents, editBirthdayEnabled, undefined, color);
  };

  const handleEmbedFooterChange = (footer: string) => {
    setEditEmbedFooter(footer);
    checkForChanges(editEnabledEvents, editBirthdayEnabled, undefined, undefined, footer);
  };

  const toggleEditEmbedThumbnail = () => {
    const newThumbnail = !editEmbedThumbnail;
    setEditEmbedThumbnail(newThumbnail);
    checkForChanges(editEnabledEvents, editBirthdayEnabled, undefined, undefined, undefined, newThumbnail);
  };

  const checkForChanges = (events?: string[], birthday?: boolean, embedTitle?: string, embedColor?: string, embedFooter?: string, embedThumbnail?: boolean) => {
    if (!integration) return;

    // Check all possible changes
    const eventsChanged = events ? JSON.stringify(events.sort()) !== JSON.stringify(integration.enabledEvents.sort()) : false;
    const birthdayChanged = birthday !== undefined ? birthday !== integration.birthdayEnabled : false;
    const embedTitleChanged = (embedTitle !== undefined ? embedTitle : editEmbedTitle) !== (integration.embedTitle || '');
    const embedColorChanged = (embedColor !== undefined ? embedColor : editEmbedColor) !== (integration.embedColor || '');
    const embedFooterChanged = (embedFooter !== undefined ? embedFooter : editEmbedFooter) !== (integration.embedFooter || '');
    const embedThumbnailChanged = (embedThumbnail !== undefined ? embedThumbnail : editEmbedThumbnail) !== integration.embedThumbnail;

    // Check user action embed changes
    const promotionTitleChanged = editPromotionEmbedTitle !== (integration.promotionEmbedTitle || '');
    const promotionColorChanged = editPromotionEmbedColor !== (integration.promotionEmbedColor || '');
    const promotionDescChanged = editPromotionEmbedDescription !== (integration.promotionEmbedDescription || '');
    const promotionFooterChanged = editPromotionEmbedFooter !== (integration.promotionEmbedFooter || '');

    const demotionTitleChanged = editDemotionEmbedTitle !== (integration.demotionEmbedTitle || '');
    const demotionColorChanged = editDemotionEmbedColor !== (integration.demotionEmbedColor || '');
    const demotionDescChanged = editDemotionEmbedDescription !== (integration.demotionEmbedDescription || '');
    const demotionFooterChanged = editDemotionEmbedFooter !== (integration.demotionEmbedFooter || '');

    const warningTitleChanged = editWarningEmbedTitle !== (integration.warningEmbedTitle || '');
    const warningColorChanged = editWarningEmbedColor !== (integration.warningEmbedColor || '');
    const warningDescChanged = editWarningEmbedDescription !== (integration.warningEmbedDescription || '');
    const warningFooterChanged = editWarningEmbedFooter !== (integration.warningEmbedFooter || '');

    const terminationTitleChanged = editTerminationEmbedTitle !== (integration.terminationEmbedTitle || '');
    const terminationColorChanged = editTerminationEmbedColor !== (integration.terminationEmbedColor || '');
    const terminationDescChanged = editTerminationEmbedDescription !== (integration.terminationEmbedDescription || '');
    const terminationFooterChanged = editTerminationEmbedFooter !== (integration.terminationEmbedFooter || '');

    // Check birthday embed changes
    const birthdayTitleChanged = editBirthdayEmbedTitle !== (integration.birthdayEmbedTitle || '');
    const birthdayColorChanged = editBirthdayEmbedColor !== (integration.birthdayEmbedColor || '');
    const birthdayDescChanged = editBirthdayEmbedDescription !== (integration.birthdayEmbedDescription || '');

    // Check notice embed changes
    const noticeSubmitTitleChanged = editNoticeSubmitEmbedTitle !== (integration.noticeSubmitEmbedTitle || '');
    const noticeSubmitColorChanged = editNoticeSubmitEmbedColor !== (integration.noticeSubmitEmbedColor || '');
    const noticeSubmitDescChanged = editNoticeSubmitEmbedDescription !== (integration.noticeSubmitEmbedDescription || '');
    const noticeSubmitFooterChanged = editNoticeSubmitEmbedFooter !== (integration.noticeSubmitEmbedFooter || '');

    const noticeApprovalTitleChanged = editNoticeApprovalEmbedTitle !== (integration.noticeApprovalEmbedTitle || '');
    const noticeApprovalColorChanged = editNoticeApprovalEmbedColor !== (integration.noticeApprovalEmbedColor || '');
    const noticeApprovalDescChanged = editNoticeApprovalEmbedDescription !== (integration.noticeApprovalEmbedDescription || '');
    const noticeApprovalFooterChanged = editNoticeApprovalEmbedFooter !== (integration.noticeApprovalEmbedFooter || '');

    const noticeDenialTitleChanged = editNoticeDenialEmbedTitle !== (integration.noticeDenialEmbedTitle || '');
    const noticeDenialColorChanged = editNoticeDenialEmbedColor !== (integration.noticeDenialEmbedColor || '');
    const noticeDenialDescChanged = editNoticeDenialEmbedDescription !== (integration.noticeDenialEmbedDescription || '');
    const noticeDenialFooterChanged = editNoticeDenialEmbedFooter !== (integration.noticeDenialEmbedFooter || '');

    // Check session notification changes
    const sessionNotifyCreateChanged = editSessionNotifyOnCreate !== (integration.sessionNotifyOnCreate || false);
    const sessionNotifyClaimChanged = editSessionNotifyOnClaim !== (integration.sessionNotifyOnClaim || false);
    const sessionNotifyStartChanged = editSessionNotifyOnStart !== (integration.sessionNotifyOnStart || false);
    const sessionChannelChanged = editSessionChannelId !== (integration.sessionChannelId || '');
    const sessionTitleChanged = editSessionEmbedTitle !== (integration.sessionEmbedTitle || '');
    const sessionColorChanged = editSessionEmbedColor !== (integration.sessionEmbedColor || '');
    const sessionDescChanged = editSessionEmbedDescription !== (integration.sessionEmbedDescription || '');
    const sessionFooterChanged = editSessionEmbedFooter !== (integration.sessionEmbedFooter || '');
    const sessionCreateTitleChanged = editSessionCreateEmbedTitle !== (integration.sessionCreateEmbedTitle || '');
    const sessionCreateColorChanged = editSessionCreateEmbedColor !== (integration.sessionCreateEmbedColor || '');
    const sessionCreateDescChanged = editSessionCreateEmbedDescription !== (integration.sessionCreateEmbedDescription || '');
    const sessionCreateFooterChanged = editSessionCreateEmbedFooter !== (integration.sessionCreateEmbedFooter || '');
    const sessionClaimTitleChanged = editSessionClaimEmbedTitle !== (integration.sessionClaimEmbedTitle || '');
    const sessionClaimColorChanged = editSessionClaimEmbedColor !== (integration.sessionClaimEmbedColor || '');
    const sessionClaimDescChanged = editSessionClaimEmbedDescription !== (integration.sessionClaimEmbedDescription || '');
    const sessionClaimFooterChanged = editSessionClaimEmbedFooter !== (integration.sessionClaimEmbedFooter || '');
    const sessionStartTitleChanged = editSessionStartEmbedTitle !== (integration.sessionStartEmbedTitle || '');
    const sessionStartColorChanged = editSessionStartEmbedColor !== (integration.sessionStartEmbedColor || '');
    const sessionStartDescChanged = editSessionStartEmbedDescription !== (integration.sessionStartEmbedDescription || '');
    const sessionStartFooterChanged = editSessionStartEmbedFooter !== (integration.sessionStartEmbedFooter || '');
    const pingRolesChanged = JSON.stringify(editPingRoles) !== JSON.stringify(integration.pingRoles || {});

    // Check session review embed changes
    const sessionReviewTitleChanged = editSessionReviewEmbedTitle !== (integration.sessionReviewEmbedTitle || '');
    const sessionReviewColorChanged = editSessionReviewEmbedColor !== (integration.sessionReviewEmbedColor || '');
    const sessionReviewDescChanged = editSessionReviewEmbedDescription !== (integration.sessionReviewEmbedDescription || '');
    const sessionReviewFooterChanged = editSessionReviewEmbedFooter !== (integration.sessionReviewEmbedFooter || '');

    setHasChanges(
      eventsChanged || birthdayChanged || embedTitleChanged || embedColorChanged ||
      embedFooterChanged || embedThumbnailChanged || promotionTitleChanged ||
      promotionColorChanged || promotionDescChanged || promotionFooterChanged || demotionTitleChanged ||
      demotionColorChanged || demotionDescChanged || demotionFooterChanged || warningTitleChanged ||
      warningColorChanged || warningDescChanged || warningFooterChanged || terminationTitleChanged ||
      terminationColorChanged || terminationDescChanged || terminationFooterChanged || birthdayTitleChanged ||
      birthdayColorChanged || birthdayDescChanged || noticeSubmitTitleChanged || noticeSubmitColorChanged ||
      noticeSubmitDescChanged || noticeSubmitFooterChanged || noticeApprovalTitleChanged ||
      noticeApprovalColorChanged || noticeApprovalDescChanged || noticeApprovalFooterChanged ||
      noticeDenialTitleChanged || noticeDenialColorChanged || noticeDenialDescChanged || noticeDenialFooterChanged ||
      sessionNotifyCreateChanged || sessionNotifyClaimChanged || sessionNotifyStartChanged || sessionChannelChanged ||
      sessionTitleChanged || sessionColorChanged || sessionDescChanged || sessionFooterChanged ||
      sessionCreateTitleChanged || sessionCreateColorChanged || sessionCreateDescChanged || sessionCreateFooterChanged ||
      sessionClaimTitleChanged || sessionClaimColorChanged || sessionClaimDescChanged || sessionClaimFooterChanged ||
      sessionStartTitleChanged || sessionStartColorChanged || sessionStartDescChanged || sessionStartFooterChanged ||
      pingRolesChanged ||
      sessionReviewTitleChanged || sessionReviewColorChanged || sessionReviewDescChanged || sessionReviewFooterChanged
    );
  };

  const enterEditMode = () => {
    if (!integration) return;
    setEditEnabledEvents([...integration.enabledEvents]);
    setEditBirthdayEnabled(integration.birthdayEnabled);
    setEditEmbedTitle(integration.embedTitle || '');
    setEditEmbedColor(integration.embedColor || '');
    setEditEmbedFooter(integration.embedFooter || '');
    setEditEmbedThumbnail(integration.embedThumbnail);

    // Populate user action embed states
    setEditPromotionEmbedTitle(integration.promotionEmbedTitle || '');
    setEditPromotionEmbedColor(integration.promotionEmbedColor || '');
    setEditPromotionEmbedDescription(integration.promotionEmbedDescription || '');
    setEditPromotionEmbedFooter(integration.promotionEmbedFooter || '');

    setEditDemotionEmbedTitle(integration.demotionEmbedTitle || '');
    setEditDemotionEmbedColor(integration.demotionEmbedColor || '');
    setEditDemotionEmbedDescription(integration.demotionEmbedDescription || '');
    setEditDemotionEmbedFooter(integration.demotionEmbedFooter || '');

    setEditWarningEmbedTitle(integration.warningEmbedTitle || '');
    setEditWarningEmbedColor(integration.warningEmbedColor || '');
    setEditWarningEmbedDescription(integration.warningEmbedDescription || '');
    setEditWarningEmbedFooter(integration.warningEmbedFooter || '');

    setEditTerminationEmbedTitle(integration.terminationEmbedTitle || '');
    setEditTerminationEmbedColor(integration.terminationEmbedColor || '');
    setEditTerminationEmbedDescription(integration.terminationEmbedDescription || '');
    setEditTerminationEmbedFooter(integration.terminationEmbedFooter || '');

    // Populate birthday embed states
    setEditBirthdayEmbedTitle(integration.birthdayEmbedTitle || '');
    setEditBirthdayEmbedColor(integration.birthdayEmbedColor || '');
    setEditBirthdayEmbedDescription(integration.birthdayEmbedDescription || '');

    // Populate notice embed states
    setEditNoticeSubmitEmbedTitle(integration.noticeSubmitEmbedTitle || '');
    setEditNoticeSubmitEmbedColor(integration.noticeSubmitEmbedColor || '');
    setEditNoticeSubmitEmbedDescription(integration.noticeSubmitEmbedDescription || '');
    setEditNoticeSubmitEmbedFooter(integration.noticeSubmitEmbedFooter || '');

    setEditNoticeApprovalEmbedTitle(integration.noticeApprovalEmbedTitle || '');
    setEditNoticeApprovalEmbedColor(integration.noticeApprovalEmbedColor || '');
    setEditNoticeApprovalEmbedDescription(integration.noticeApprovalEmbedDescription || '');
    setEditNoticeApprovalEmbedFooter(integration.noticeApprovalEmbedFooter || '');

    setEditNoticeDenialEmbedTitle(integration.noticeDenialEmbedTitle || '');
    setEditNoticeDenialEmbedColor(integration.noticeDenialEmbedColor || '');
    setEditNoticeDenialEmbedDescription(integration.noticeDenialEmbedDescription || '');
    setEditNoticeDenialEmbedFooter(integration.noticeDenialEmbedFooter || '');

    // Populate session states
    setEditSessionNotifyOnCreate(integration.sessionNotifyOnCreate || false);
    setEditSessionNotifyOnClaim(integration.sessionNotifyOnClaim || false);
    setEditSessionNotifyOnStart(integration.sessionNotifyOnStart || false);
    setEditSessionChannelId(integration.sessionChannelId || '');
    setEditSessionEmbedTitle(integration.sessionEmbedTitle || '');
    setEditSessionEmbedColor(integration.sessionEmbedColor || '');
    setEditSessionEmbedDescription(integration.sessionEmbedDescription || '');
    setEditSessionEmbedFooter(integration.sessionEmbedFooter || '');
    setEditSessionCreateEmbedTitle(integration.sessionCreateEmbedTitle || '');
    setEditSessionCreateEmbedColor(integration.sessionCreateEmbedColor || '');
    setEditSessionCreateEmbedDescription(integration.sessionCreateEmbedDescription || '');
    setEditSessionCreateEmbedFooter(integration.sessionCreateEmbedFooter || '');
    setEditSessionClaimEmbedTitle(integration.sessionClaimEmbedTitle || '');
    setEditSessionClaimEmbedColor(integration.sessionClaimEmbedColor || '');
    setEditSessionClaimEmbedDescription(integration.sessionClaimEmbedDescription || '');
    setEditSessionClaimEmbedFooter(integration.sessionClaimEmbedFooter || '');
    setEditSessionStartEmbedTitle(integration.sessionStartEmbedTitle || '');
    setEditSessionStartEmbedColor(integration.sessionStartEmbedColor || '');
    setEditSessionStartEmbedDescription(integration.sessionStartEmbedDescription || '');
    setEditSessionStartEmbedFooter(integration.sessionStartEmbedFooter || '');

    // Populate session review embed states
    setEditSessionReviewEmbedTitle(integration.sessionReviewEmbedTitle || '');
    setEditSessionReviewEmbedColor(integration.sessionReviewEmbedColor || '');
    setEditSessionReviewEmbedDescription(integration.sessionReviewEmbedDescription || '');
    setEditSessionReviewEmbedFooter(integration.sessionReviewEmbedFooter || '');

    const savedPingRoles = { ...(integration.pingRoles || {}) } as Record<string, string>;
    if (integration.sessionPingRoleId && !savedPingRoles['session']) {
      savedPingRoles['session'] = integration.sessionPingRoleId;
    }
    setEditPingRoles(savedPingRoles);

    setEditMode(true);
    setHasChanges(false);
  };

  const saveChanges = async () => {
    if (!integration) return;

    setLoading(true);
    try {
      const res = await axios.post(`/api/workspace/${workspace.groupId}/settings/discord/configure`, {
        botToken: "existing",
        guildId: integration.guildId,
        channelId: integration.channelId,
        enabledEvents: editEnabledEvents,
        guildName: integration.guildName,
        channelName: integration.channelName,
        birthdayChannelId: integration.birthdayChannelId,
        birthdayChannelName: integration.birthdayChannelName,
        birthdayEnabled: editBirthdayEnabled,
        embedTitle: editEmbedTitle || null,
        embedColor: editEmbedColor || null,
        embedFooter: editEmbedFooter || null,
        embedThumbnail: editEmbedThumbnail,
        // User action embed templates
        promotionEmbedTitle: editPromotionEmbedTitle || null,
        promotionEmbedColor: editPromotionEmbedColor || null,
        promotionEmbedDescription: editPromotionEmbedDescription || null,
        promotionEmbedFooter: editPromotionEmbedFooter || null,
        demotionEmbedTitle: editDemotionEmbedTitle || null,
        demotionEmbedColor: editDemotionEmbedColor || null,
        demotionEmbedDescription: editDemotionEmbedDescription || null,
        demotionEmbedFooter: editDemotionEmbedFooter || null,
        warningEmbedTitle: editWarningEmbedTitle || null,
        warningEmbedColor: editWarningEmbedColor || null,
        warningEmbedDescription: editWarningEmbedDescription || null,
        warningEmbedFooter: editWarningEmbedFooter || null,
        terminationEmbedTitle: editTerminationEmbedTitle || null,
        terminationEmbedColor: editTerminationEmbedColor || null,
        terminationEmbedDescription: editTerminationEmbedDescription || null,
        terminationEmbedFooter: editTerminationEmbedFooter || null,
        // Birthday embed templates
        birthdayEmbedTitle: editBirthdayEmbedTitle || null,
        birthdayEmbedColor: editBirthdayEmbedColor || null,
        birthdayEmbedDescription: editBirthdayEmbedDescription || null,
        // Notice embed templates
        noticeSubmitEmbedTitle: editNoticeSubmitEmbedTitle || null,
        noticeSubmitEmbedColor: editNoticeSubmitEmbedColor || null,
        noticeSubmitEmbedDescription: editNoticeSubmitEmbedDescription || null,
        noticeSubmitEmbedFooter: editNoticeSubmitEmbedFooter || null,
        noticeApprovalEmbedTitle: editNoticeApprovalEmbedTitle || null,
        noticeApprovalEmbedColor: editNoticeApprovalEmbedColor || null,
        noticeApprovalEmbedDescription: editNoticeApprovalEmbedDescription || null,
        noticeApprovalEmbedFooter: editNoticeApprovalEmbedFooter || null,
        noticeDenialEmbedTitle: editNoticeDenialEmbedTitle || null,
        noticeDenialEmbedColor: editNoticeDenialEmbedColor || null,
        noticeDenialEmbedDescription: editNoticeDenialEmbedDescription || null,
        noticeDenialEmbedFooter: editNoticeDenialEmbedFooter || null,
        // Session notification fields
        sessionChannelId: editSessionChannelId || null,
        sessionChannelName: editSessionChannelId ? (sessionChannels.find(c => c.id === editSessionChannelId)?.name || null) : null,
        sessionNotifyOnCreate: editSessionNotifyOnCreate,
        sessionNotifyOnClaim: editSessionNotifyOnClaim,
        sessionNotifyOnStart: editSessionNotifyOnStart,
        sessionEmbedTitle: editSessionEmbedTitle || null,
        sessionEmbedColor: editSessionEmbedColor || null,
        sessionEmbedDescription: editSessionEmbedDescription || null,
        sessionEmbedFooter: editSessionEmbedFooter || null,
        sessionCreateEmbedTitle: editSessionCreateEmbedTitle || null,
        sessionCreateEmbedColor: editSessionCreateEmbedColor || null,
        sessionCreateEmbedDescription: editSessionCreateEmbedDescription || null,
        sessionCreateEmbedFooter: editSessionCreateEmbedFooter || null,
        sessionClaimEmbedTitle: editSessionClaimEmbedTitle || null,
        sessionClaimEmbedColor: editSessionClaimEmbedColor || null,
        sessionClaimEmbedDescription: editSessionClaimEmbedDescription || null,
        sessionClaimEmbedFooter: editSessionClaimEmbedFooter || null,
        sessionStartEmbedTitle: editSessionStartEmbedTitle || null,
        sessionStartEmbedColor: editSessionStartEmbedColor || null,
        sessionStartEmbedDescription: editSessionStartEmbedDescription || null,
        sessionStartEmbedFooter: editSessionStartEmbedFooter || null,
        // Session review embed templates
        sessionReviewEmbedTitle: editSessionReviewEmbedTitle || null,
        sessionReviewEmbedColor: editSessionReviewEmbedColor || null,
        sessionReviewEmbedDescription: editSessionReviewEmbedDescription || null,
        sessionReviewEmbedFooter: editSessionReviewEmbedFooter || null,
        sessionPingRoleId: editPingRoles['session'] || null,
        sessionPingRoleName: editPingRoles['session'] ? (discordRoles.find(r => r.id === editPingRoles['session'])?.name || null) : null,
        pingRoles: editPingRoles,
      });

      if (res.data?.success) {
        setIntegration(res.data.integration);
        setEditMode(false);
        setHasChanges(false);
        triggerToast?.success('Settings updated successfully!');
      } else {
        triggerToast?.error(res.data?.error || 'Failed to update settings');
      }
    } catch (e: any) {
      triggerToast?.error(e.response?.data?.error || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setEnabledEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  // Tab render functions
  const renderConfigurationTab = () => (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-zinc-900 dark:text-white truncate">
              <span className="font-medium">{integration?.guildName}</span>
              <span className="text-zinc-400 mx-1.5">/</span>
              <span className="font-mono text-zinc-600 dark:text-zinc-400">#{integration?.channelName}</span>
            </p>
            {integration?.lastMessageAt && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Last sent {new Date(integration.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchIntegrationStatus()}
            disabled={loading}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
            title="Refresh status"
          >
            <IconRefresh className="w-4 h-4" />
          </button>
          {hasChanges && (
            <button
              onClick={saveChanges}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {integration && integration.errorCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          <IconAlertTriangle className="w-4 h-4 shrink-0" />
          <span>{integration.errorCount} error(s)</span>
          {integration.lastError && (
            <span className="text-xs font-mono text-amber-500 truncate ml-1">— {integration.lastError}</span>
          )}
        </div>
      )}

      {/* Channel Events */}
      <div>
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">Channel Events</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {EVENT_TYPES.map(event => {
            const isEnabled = editEnabledEvents.includes(event.id);

            return (
              <div
                key={event.id}
                onClick={() => toggleEditEvent(event.id)}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors cursor-pointer hover:opacity-80 ${
                  isEnabled
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isEnabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                  <span className="font-medium truncate">{event.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Birthday toggle */}
      <div>
        <div
          onClick={toggleEditBirthday}
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors cursor-pointer hover:opacity-80 ${
            editBirthdayEnabled
              ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800'
              : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <IconCake className={`w-4 h-4 ${editBirthdayEnabled ? 'text-pink-500' : 'text-zinc-400'}`} />
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Birthday Notifications</p>
              {editBirthdayEnabled && integration?.birthdayChannelName && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Sending to <span className="font-mono">#{integration.birthdayChannelName}</span>
                </p>
              )}
            </div>
          </div>
          <div className={`w-8 h-5 rounded-full relative transition-colors ${
            editBirthdayEnabled ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-600'
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
              editBirthdayEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
            }`} />
          </div>
        </div>
      </div>

      {/* Session Notifications */}
      <div>
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">Session Notifications</h4>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'create', label: 'On create', value: editSessionNotifyOnCreate, toggle: () => { setEditSessionNotifyOnCreate(!editSessionNotifyOnCreate); checkForChanges(); } },
              { key: 'claim', label: 'On claim', value: editSessionNotifyOnClaim, toggle: () => { setEditSessionNotifyOnClaim(!editSessionNotifyOnClaim); checkForChanges(); } },
              { key: 'start', label: 'On start', value: editSessionNotifyOnStart, toggle: () => { setEditSessionNotifyOnStart(!editSessionNotifyOnStart); checkForChanges(); } },
            ].map(item => (
              <div
                key={item.key}
                onClick={item.toggle}
                className={`px-3 py-2 rounded-lg border text-sm text-center transition-colors cursor-pointer hover:opacity-80 ${
                  item.value
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium'
                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Channel */}
      <div>
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">Session Channel</h4>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <IconCalendarEvent className="w-4 h-4 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Channel</p>
          </div>
          <select
            value={editSessionChannelId}
            onChange={(e) => { setEditSessionChannelId(e.target.value); checkForChanges(); }}
            onFocus={fetchSessionChannels}
            className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm min-w-[180px]"
          >
            <option value="">Using main channel</option>
            {loadingSessionChannels && <option disabled>Loading channels...</option>}
            {sessionChannels.map(ch => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Remove integration */}
      <div>
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">Danger Zone</h4>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2.5">
            <IconTrash className="w-4 h-4 text-red-500" />
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Remove Integration</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Disconnect Discord and delete all settings</p>
            </div>
          </div>
          <button
            onClick={() => setShowRemoveModal(true)}
            disabled={loading}
            className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Remove integration modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <IconTrash className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Remove Integration</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-1">
                Are you sure you want to remove the Discord integration for <span className="font-medium text-zinc-900 dark:text-white">{integration?.guildName}</span>?
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                All notification settings, embed customizations, and event configurations will be permanently deleted. You&apos;ll need to set up the integration again from scratch.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setShowRemoveModal(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={removeIntegration}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const EMBED_CATEGORIES = [
    { key: 'general', label: 'General', icon: IconBell, target: 'channel' as const },
    { key: 'promotion', label: 'Promotion', icon: IconTrendingUp, target: 'dm' as const },
    { key: 'demotion', label: 'Demotion', icon: IconTrendingDown, target: 'dm' as const },
    { key: 'warning', label: 'Warning', icon: IconAlertTriangle, target: 'dm' as const },
    { key: 'termination', label: 'Termination', icon: IconBan, target: 'dm' as const },
    { key: 'birthday', label: 'Birthday', icon: IconCake, target: 'channel' as const },
    { key: 'notice-submit', label: 'Notice', icon: IconFileText, target: 'dm' as const },
    { key: 'notice-approval', label: 'Approved', icon: IconCircleCheck, target: 'dm' as const },
    { key: 'notice-denial', label: 'Denied', icon: IconCircleX, target: 'dm' as const },
    { key: 'session-create', label: 'Created', icon: IconCalendarEvent, target: 'channel' as const },
    { key: 'session-claim', label: 'Claimed', icon: IconCalendarEvent, target: 'channel' as const },
    { key: 'session-start', label: 'Started', icon: IconCalendarEvent, target: 'channel' as const },
    { key: 'session-review', label: 'Review', icon: IconClipboardCheck, target: 'dm' as const },
  ];

  const getEmbedValues = (cat: string) => {
    switch (cat) {
      case 'general': return { title: editEmbedTitle, color: editEmbedColor || '#5865F2', description: '', footer: editEmbedFooter };
      case 'promotion': return { title: editPromotionEmbedTitle, color: editPromotionEmbedColor || '#00ff00', description: editPromotionEmbedDescription, footer: editPromotionEmbedFooter };
      case 'demotion': return { title: editDemotionEmbedTitle, color: editDemotionEmbedColor || '#ff6600', description: editDemotionEmbedDescription, footer: editDemotionEmbedFooter };
      case 'warning': return { title: editWarningEmbedTitle, color: editWarningEmbedColor || '#ffa500', description: editWarningEmbedDescription, footer: editWarningEmbedFooter };
      case 'termination': return { title: editTerminationEmbedTitle, color: editTerminationEmbedColor || '#ff0000', description: editTerminationEmbedDescription, footer: editTerminationEmbedFooter };
      case 'birthday': return { title: editBirthdayEmbedTitle, color: editBirthdayEmbedColor || '#FF0099', description: editBirthdayEmbedDescription, footer: '' };
      case 'notice-submit': return { title: editNoticeSubmitEmbedTitle, color: editNoticeSubmitEmbedColor || '#3b82f6', description: editNoticeSubmitEmbedDescription, footer: editNoticeSubmitEmbedFooter };
      case 'notice-approval': return { title: editNoticeApprovalEmbedTitle, color: editNoticeApprovalEmbedColor || '#10b981', description: editNoticeApprovalEmbedDescription, footer: editNoticeApprovalEmbedFooter };
      case 'notice-denial': return { title: editNoticeDenialEmbedTitle, color: editNoticeDenialEmbedColor || '#ef4444', description: editNoticeDenialEmbedDescription, footer: editNoticeDenialEmbedFooter };
      case 'session': return { title: editSessionEmbedTitle, color: editSessionEmbedColor || '#3b82f6', description: editSessionEmbedDescription, footer: editSessionEmbedFooter };
      case 'session-create': return { title: editSessionCreateEmbedTitle, color: editSessionCreateEmbedColor || '#10b981', description: editSessionCreateEmbedDescription, footer: editSessionCreateEmbedFooter };
      case 'session-claim': return { title: editSessionClaimEmbedTitle, color: editSessionClaimEmbedColor || '#f59e0b', description: editSessionClaimEmbedDescription, footer: editSessionClaimEmbedFooter };
      case 'session-start': return { title: editSessionStartEmbedTitle, color: editSessionStartEmbedColor || '#3b82f6', description: editSessionStartEmbedDescription, footer: editSessionStartEmbedFooter };
      case 'session-review': return { title: editSessionReviewEmbedTitle, color: editSessionReviewEmbedColor || '#5865F2', description: editSessionReviewEmbedDescription, footer: editSessionReviewEmbedFooter };
      default: return { title: '', color: '#5865F2', description: '', footer: '' };
    }
  };

  const setEmbedValue = (cat: string, field: string, value: string) => {
    const setters: Record<string, Record<string, (v: string) => void>> = {
      general: { title: (v) => handleEmbedTitleChange(v), color: (v) => handleEmbedColorChange(v), footer: (v) => handleEmbedFooterChange(v) },
      promotion: { title: setEditPromotionEmbedTitle, color: setEditPromotionEmbedColor, description: setEditPromotionEmbedDescription, footer: setEditPromotionEmbedFooter },
      demotion: { title: setEditDemotionEmbedTitle, color: setEditDemotionEmbedColor, description: setEditDemotionEmbedDescription, footer: setEditDemotionEmbedFooter },
      warning: { title: setEditWarningEmbedTitle, color: setEditWarningEmbedColor, description: setEditWarningEmbedDescription, footer: setEditWarningEmbedFooter },
      termination: { title: setEditTerminationEmbedTitle, color: setEditTerminationEmbedColor, description: setEditTerminationEmbedDescription, footer: setEditTerminationEmbedFooter },
      birthday: { title: setEditBirthdayEmbedTitle, color: setEditBirthdayEmbedColor, description: setEditBirthdayEmbedDescription },
      'notice-submit': { title: setEditNoticeSubmitEmbedTitle, color: setEditNoticeSubmitEmbedColor, description: setEditNoticeSubmitEmbedDescription, footer: setEditNoticeSubmitEmbedFooter },
      'notice-approval': { title: setEditNoticeApprovalEmbedTitle, color: setEditNoticeApprovalEmbedColor, description: setEditNoticeApprovalEmbedDescription, footer: setEditNoticeApprovalEmbedFooter },
      'notice-denial': { title: setEditNoticeDenialEmbedTitle, color: setEditNoticeDenialEmbedColor, description: setEditNoticeDenialEmbedDescription, footer: setEditNoticeDenialEmbedFooter },
      'session': { title: setEditSessionEmbedTitle, color: setEditSessionEmbedColor, description: setEditSessionEmbedDescription, footer: setEditSessionEmbedFooter },
      'session-create': { title: setEditSessionCreateEmbedTitle, color: setEditSessionCreateEmbedColor, description: setEditSessionCreateEmbedDescription, footer: setEditSessionCreateEmbedFooter },
      'session-claim': { title: setEditSessionClaimEmbedTitle, color: setEditSessionClaimEmbedColor, description: setEditSessionClaimEmbedDescription, footer: setEditSessionClaimEmbedFooter },
      'session-start': { title: setEditSessionStartEmbedTitle, color: setEditSessionStartEmbedColor, description: setEditSessionStartEmbedDescription, footer: setEditSessionStartEmbedFooter },
      'session-review': { title: setEditSessionReviewEmbedTitle, color: setEditSessionReviewEmbedColor, description: setEditSessionReviewEmbedDescription, footer: setEditSessionReviewEmbedFooter },
    };
    setters[cat]?.[field]?.(value);
    if (cat !== 'general') checkForChanges();
  };

  const getPreviewData = (cat: string) => {
    const vals = getEmbedValues(cat);
    return {
      title: vals.title,
      description: vals.description,
      footer: vals.footer,
      color: vals.color,
    };
  };

  const getVariablesHelp = (cat: string) => {
    if (cat === 'general') return ['{action}', '{user}', '{username}'];
    if (cat === 'birthday') return ['{user}', '{username}', '{workspace}'];
    if (cat.startsWith('notice')) return ['{username}', '{userId}', '{workspace}', '{reason}', '{startDate}', '{endDate}', ...(cat !== 'notice-submit' ? ['{reviewedBy}', '{reviewComment}'] : [])];
    if (cat === 'session-review') return ['{username}', '{workspace}', '{duration}', '{activeTime}', '{idleTime}', '{messages}', '{sessionMessage}'];
    if (cat === 'session' || cat.startsWith('session-')) return ['{sessionName}', '{host}', '{date}', '{type}', '{duration}', '{sessionTypeName}', '{workspace}'];
    return ['{user}', '{username}', '{workspace}', '{reason}', '{issuedBy}', ...(cat !== 'warning' ? ['{newRank}', '{oldRank}'] : [])];
  };

  const renderEmbedCustomizationTab = () => {
    const vals = getEmbedValues(embedCategory);
    const preview = getPreviewData(embedCategory);
    const variables = getVariablesHelp(embedCategory);

    return (
      <div className="space-y-6">
        {/* Category selector */}
        <div className="flex flex-wrap gap-1.5">
          {EMBED_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setEmbedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                embedCategory === cat.key
                  ? 'bg-[#5865F2] text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
              <span className={`text-[9px] font-semibold uppercase px-1 py-px rounded ${
                embedCategory === cat.key
                  ? 'bg-white/20 text-white/80'
                  : cat.target === 'dm'
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              }`}>
                {cat.target === 'dm' ? 'DM' : '#'}
              </span>
            </button>
          ))}
        </div>

        {/* Discord Embed Preview */}
        <div className="bg-[#313338] rounded-xl p-5 shadow-lg">
          {/* Bot header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
              <IconBrandDiscord className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-white font-medium text-sm">Firefli</span>
              <span className="ml-1.5 px-1 py-0.5 bg-[#5865F2] rounded text-[10px] text-white font-medium">BOT</span>
              <p className="text-[#949ba4] text-xs">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Embed */}
          <div className="ml-12 flex">
            {/* Color bar + click to change */}
            <div className="relative group">
              <div className="w-1 rounded-l-[4px] min-h-full" style={{ backgroundColor: vals.color }} />
              <label className="absolute inset-0 cursor-pointer opacity-0">
                <input
                  type="color"
                  value={vals.color}
                  onChange={(e) => setEmbedValue(embedCategory, 'color', e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            </div>
            <div className="bg-[#2b2d31] rounded-r-[4px] p-4 flex-1 min-w-0">
              <div className="flex gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Title */}
                  <input
                    type="text"
                    value={vals.title}
                    onChange={(e) => setEmbedValue(embedCategory, 'title', e.target.value)}
                    placeholder="Title"
                    className="w-full bg-transparent text-white font-semibold text-sm placeholder-[#4e5058] outline-none border-b border-transparent hover:border-[#4e5058] focus:border-[#5865F2] transition-colors pb-0.5"
                  />

                  {/* Description with @ mention autocomplete */}
                  <div className="relative">
                    <textarea
                      value={vals.description}
                      disabled={embedCategory === 'general'}
                      onChange={(e) => {
                        if (embedCategory === 'general') return;
                        const value = e.target.value;
                        const cursorPos = e.target.selectionStart || 0;
                        setEmbedValue(embedCategory, 'description', value);
                        const textBeforeCursor = value.substring(0, cursorPos);
                        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                        if (lastAtIndex !== -1 && (lastAtIndex === 0 || /[\s\n]/.test(textBeforeCursor[lastAtIndex - 1]))) {
                          const filterText = textBeforeCursor.substring(lastAtIndex + 1);
                          if (!filterText.includes(' ') && !filterText.includes('\n')) {
                            setShowRoleMention(true);
                            setMentionFilter(filterText.toLowerCase());
                            setMentionStartPos(lastAtIndex);
                            if (discordRoles.length === 0) fetchSessionChannels();
                            return;
                          }
                        }
                        setShowRoleMention(false);
                      }}
                      onBlur={() => setTimeout(() => setShowRoleMention(false), 200)}
                      placeholder={embedCategory === 'general' ? 'Auto-generated for each event' : 'Description \u2014 type @ to mention a role'}
                      rows={2}
                      className="w-full bg-transparent text-[#dbdee1] text-sm placeholder-[#4e5058] outline-none border-b border-transparent hover:border-[#4e5058] focus:border-[#5865F2] transition-colors resize-none"
                    />
                    {showRoleMention && (
                      <div className="absolute z-10 mt-1 w-full bg-[#1e1f22] rounded-lg shadow-lg border border-[#3f4147] max-h-40 overflow-y-auto">
                        {discordRoles.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-[#949ba4]">Loading roles...</div>
                        ) : discordRoles.filter(r => r.name.toLowerCase().includes(mentionFilter)).length === 0 ? (
                          <div className="px-3 py-2 text-sm text-[#949ba4]">No matching roles</div>
                        ) : (
                          discordRoles
                            .filter(r => r.name.toLowerCase().includes(mentionFilter))
                            .slice(0, 10)
                            .map(role => (
                              <button
                                key={role.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  const currentValue = vals.description || '';
                                  const beforeAt = currentValue.substring(0, mentionStartPos);
                                  const afterFilter = currentValue.substring(mentionStartPos + 1 + mentionFilter.length);
                                  const newValue = beforeAt + '@' + role.name + ' ' + afterFilter;
                                  setEmbedValue(embedCategory, 'description', newValue);
                                  setEditPingRoles(prev => ({ ...prev, [embedCategory]: role.id }));
                                  setShowRoleMention(false);
                                  setTimeout(() => checkForChanges(), 0);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#35373c] flex items-center gap-2"
                              >
                                <span className="text-[#949ba4]">@</span>
                                <span>{role.name}</span>
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {embedCategory !== 'birthday' && (
                    <div className="pt-2 border-t border-[#3f4147] mt-2">
                      <input
                        type="text"
                        value={vals.footer}
                        onChange={(e) => setEmbedValue(embedCategory, 'footer', e.target.value)}
                        placeholder="Footer"
                        className="w-full bg-transparent text-[#949ba4] text-xs placeholder-[#4e5058] outline-none border-b border-transparent hover:border-[#4e5058] focus:border-[#5865F2] transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* Thumbnail */}
                {editEmbedThumbnail && (
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-lg bg-[#1e1f22] flex items-center justify-center overflow-hidden">
                      <img src="https://www.roblox.com/headshot-thumbnail/image?userId=1&width=180&height=180&format=png" alt="" className="w-full h-full object-cover rounded-lg" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-[#949ba4] text-[10px] ml-12 mt-2">Click on the title, description, or footer to edit. Click the color bar to change the embed color.</p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Color input */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Embed Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={vals.color}
                onChange={(e) => setEmbedValue(embedCategory, 'color', e.target.value)}
                className="w-10 h-10 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 cursor-pointer"
              />
              <input
                type="text"
                value={vals.color === '#5865F2' && !getEmbedValues(embedCategory).color ? '' : vals.color}
                onChange={(e) => setEmbedValue(embedCategory, 'color', e.target.value)}
                placeholder={vals.color}
                className="flex-1 p-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm font-mono"
              />
            </div>
          </div>

          {/* Thumbnail toggle (only for general) */}
          {embedCategory === 'general' && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Profile Thumbnails</label>
              <button
                onClick={toggleEditEmbedThumbnail}
                className={`w-full p-2.5 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  editEmbedThumbnail
                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {editEmbedThumbnail ? <IconCheck className="w-4 h-4" /> : <IconX className="w-4 h-4" />}
                {editEmbedThumbnail ? 'Showing Roblox avatars' : 'Avatars hidden'}
              </button>
            </div>
          )}
        </div>

        {/* Available variables */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Available Variables</p>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <code key={v} className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300 font-mono">{v}</code>
            ))}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Type <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded font-mono">@</code> in the description to mention a Discord role to ping</p>
        </div>

        {/* Ping role indicator */}
        {editPingRoles[embedCategory] && (
          <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#5865F2] font-medium">Pinging</span>
              <span className="px-2 py-0.5 bg-[#5865F2]/20 rounded text-sm text-[#5865F2] font-mono">
                @{discordRoles.find(r => r.id === editPingRoles[embedCategory])?.name || 'Unknown Role'}
              </span>
            </div>
            <button
              onClick={() => {
                setEditPingRoles(prev => {
                  const next = { ...prev };
                  delete next[embedCategory];
                  return next;
                });
                setTimeout(() => checkForChanges(), 0);
              }}
              className="text-xs text-zinc-500 hover:text-red-500 transition-colors"
            >
              Remove ping
            </button>
          </div>
        )}

        {/* Save */}
        {hasChanges && (
          <button
            onClick={saveChanges}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
          >
            <IconCheck className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>
    );
  };

  useEffect(() => {
    fetchIntegrationStatus();
  }, []);

  // Auto-enter edit mode when integration loads
  useEffect(() => {
    if (integration && !editMode) {
      enterEditMode();
    }
    // Fetch session channels if a session channel is configured
    if (integration && (integration.sessionChannelId || integration.sessionNotifyOnCreate || integration.sessionNotifyOnClaim || integration.sessionNotifyOnStart)) {
      fetchSessionChannels();
    }
  }, [integration]);

  useEffect(() => {
    if (activeTab === 'embeds' && integration && discordRoles.length === 0) {
      fetchSessionChannels();
    }
  }, [activeTab, embedCategory]);

  if (integration) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <IconBrandDiscord className="w-8 h-8 text-[#5865F2]" />
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Discord Integration</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Connected and active</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-zinc-200 dark:border-zinc-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('configuration')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'configuration'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              <IconSettings className="w-4 h-4" />
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('embeds')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'embeds'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              <IconPalette className="w-4 h-4" />
              Embed Customization
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'configuration' && (
          <div className="space-y-6">{renderConfigurationTab()}</div>
        )}

        {activeTab === 'embeds' && (
          <div className="space-y-6">{renderEmbedCustomizationTab()}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <IconBrandDiscord className="w-8 h-8 text-[#5865F2]" />
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Discord Integration</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Send workspace event notifications to Discord</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-decimal list-inside">
          <li>Create a Discord bot at <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="underline">discord.com/developers/applications</a></li>
          <li>Invite your bot to your Discord server with admin permissions</li>
          <li>Copy the bot token and paste it below</li>
          <li>Select your Discord server and channel for notifications</li>
          <li>Choose which events you want to receive notifications for</li>
        </ol>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="botToken" className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
              Discord Bot Token
            </label>
            <input
              id="botToken"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Paste your Discord bot token here..."
              className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            />
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
              Your bot token will be encrypted and stored securely
            </p>
          </div>
          <button
            onClick={validateToken}
            disabled={loading || !botToken.trim()}
            className="w-full md:w-auto px-6 py-3 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Validating...' : 'Validate Token'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-zinc-900 dark:text-white mb-3">Select Discord Server</h4>
            <div className="grid gap-3">
              {guilds.map(guild => (
                <button
                  key={guild.id}
                  onClick={() => fetchChannels(guild.id)}
                  disabled={loading}
                  className="flex items-center gap-3 p-4 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 text-left disabled:opacity-50"
                >
                  <div className="w-12 h-12 bg-[#5865F2] rounded-lg flex items-center justify-center text-white font-medium">
                    {guild.icon ? (
                      <img
                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                        alt={guild.name}
                        className="w-12 h-12 rounded-lg"
                      />
                    ) : (
                      guild.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{guild.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {guild.owner ? 'Owner' : 'Admin'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← Back to token
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-zinc-900 dark:text-white mb-3">Select Channel</h4>
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setSelectedChannel(channel.id);
                    setStep(4);
                  }}
                  className="flex items-center gap-3 p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 text-left"
                >
                  <span className="text-zinc-600 dark:text-zinc-400">#</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{channel.name}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← Back to server selection
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-zinc-900 dark:text-white mb-3">Select Events to Monitor</h4>
            <div className="grid gap-3">
              {EVENT_TYPES.map(event => (
                <label
                  key={event.id}
                  className="flex items-start gap-3 p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabledEvents.includes(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{event.label}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{event.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={saveIntegration}
              disabled={loading || enabledEvents.length === 0}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Configuring...' : 'Complete Setup'}
            </button>
            <button
              onClick={() => setStep(3)}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← Back to channel selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

DiscordIntegration.title = 'Discord Integration';

export default DiscordIntegration;
