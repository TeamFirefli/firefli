import axios from 'axios';
import { useEffect, useState } from 'react';
import { workspacestate } from '@/state';
import { useRecoilState } from 'recoil';
import { IconRefresh, IconTrash, IconAlertTriangle, IconEye, IconEyeOff } from '@tabler/icons-react';
import { FC } from '@/types/settingsComponent';

type BloxlinkIntegration = {
  id: string;
  apiKey?: string;
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
};

type DiscordIntegration = {
  id: string;
  guildId: string;
  guildName: string;
  isActive: boolean;
};

const BloxlinkSettings: FC<{ triggerToast?: any }> = ({ triggerToast }) => {
  const [workspace] = useRecoilState(workspacestate);
  const [loading, setLoading] = useState(false);
  const [integration, setIntegration] = useState<BloxlinkIntegration | null>(null);
  const [discordIntegration, setDiscordIntegration] = useState<DiscordIntegration | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  // Form states
  const [apiKey, setApiKey] = useState('');
  const [discordServerId, setDiscordServerId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Status
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchIntegrationStatus = async () => {
    try {
      const response = await axios.get(`/api/workspace/${workspace?.groupId}/settings/bloxlink/status`);
      if (response.data.success) {
        setIntegration(response.data.integration);
        if (response.data.integration) {
          setDiscordServerId(response.data.integration.discordServerId || '');
        }
      }
    } catch (error) {
      console.error('Failed to fetch Bloxlink status:', error);
    }
  };

  const fetchDiscordIntegrationStatus = async () => {
    try {
      const response = await axios.get(`/api/workspace/${workspace?.groupId}/settings/discord/status`);
      if (response.data.success) {
        setDiscordIntegration(response.data.integration);
        if (response.data.integration && !integration) {
          setDiscordServerId(response.data.integration.guildId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch Discord status:', error);
    }
  };

  useEffect(() => {
    if (workspace?.groupId) {
      fetchIntegrationStatus();
      fetchDiscordIntegrationStatus();
    }
  }, [workspace?.groupId]);

  const handleConfigure = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Please provide your Bloxlink API key');
      setStatus('error');
      return;
    }

    if (!discordServerId.trim()) {
      setErrorMessage('Discord server ID missing - ensure Discord integration is active');
      setStatus('error');
      return;
    }

    setLoading(true);
    setStatus('validating');

    try {
      const response = await axios.post(`/api/workspace/${workspace?.groupId}/settings/bloxlink/configure`, {
        apiKey: apiKey.trim(),
        discordServerId: discordServerId.trim(),
        notifyPromotion: true,
        notifyDemotion: true,
        notifyWarning: true,
      });

      if (response.data.success) {
        setStatus('success');
        setIsConfiguring(false);
        setApiKey('');
        await fetchIntegrationStatus();
        triggerToast?.success('Bloxlink integration configured successfully!');
      } else {
        setStatus('error');
        setErrorMessage(response.data.error || 'Configuration failed');
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.response?.data?.error || 'Failed to configure Bloxlink integration');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const response = await axios.delete(`/api/workspace/${workspace?.groupId}/settings/bloxlink/configure`);
      if (response.data.success) {
        setIntegration(null);
        setApiKey('');
        setDiscordServerId(discordIntegration?.guildId || '');
        setShowRemoveModal(false);
        triggerToast?.success('Bloxlink integration removed successfully');
      }
    } catch (error) {
      console.error('Failed to disconnect Bloxlink:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!integration) return;

    setLoading(true);
    try {
      const response = await axios.post(`/api/workspace/${workspace?.groupId}/settings/bloxlink/simple-test`);
      if (response.data.success) {
        triggerToast?.success(response.data.message || 'Test notification sent successfully!');
        await fetchIntegrationStatus();
      } else {
        triggerToast?.error(response.data.error || 'Test failed');
      }
    } catch (error: any) {
      console.error('Bloxlink test error:', error);
      const errMsg = error.response?.data?.error || error.message || 'Unknown error';
      triggerToast?.error(`Test failed: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Discord not configured state
  if (!discordIntegration || !discordIntegration.isActive) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <img src="/bloxlink.png" alt="Bloxlink" className="w-8 h-8" />
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Bloxlink Integration</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Send Discord DMs to users for actions</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          <IconAlertTriangle className="w-4 h-4 shrink-0" />
          <span>Discord integration must be configured first before setting up Bloxlink.</span>
        </div>
      </div>
    );
  }

  // Not configured, show setup
  if (!integration && !isConfiguring) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <img src="/bloxlink.png" alt="Bloxlink" className="w-8 h-8" />
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Bloxlink Integration</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Send Discord DMs to users for actions</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Automatically send direct messages to users on Discord when they get promoted, demoted, or warned.
            Uses Bloxlink to resolve Roblox accounts to Discord accounts.
          </p>
          <button
            onClick={() => setIsConfiguring(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Setup Integration
          </button>
        </div>
      </div>
    );
  }

  // Setup flow
  if (isConfiguring) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <img src="/bloxlink.png" alt="Bloxlink" className="w-8 h-8" />
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Bloxlink Integration</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Configure your API key to get started</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* API Key */}
          <div>
            <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">API Key</h4>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Bloxlink API key"
                className="w-full p-3 pr-12 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showApiKey ? <IconEyeOff className="w-5 h-5" /> : <IconEye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
              Get your API key from the Bloxlink dashboard. It will be encrypted and stored securely.
            </p>
          </div>

          {/* Discord Server */}
          <div>
            <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">Discord Server</h4>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <p className="text-sm text-zinc-900 dark:text-white">
                  <span className="font-medium">{discordIntegration?.guildName}</span>
                  <span className="text-zinc-400 ml-1.5 font-mono text-xs">{discordServerId}</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
              Auto-populated from your Discord integration
            </p>
          </div>

          {/* Error */}
          {status === 'error' && errorMessage && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleConfigure}
              disabled={loading || !apiKey.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Configuring...' : 'Configure'}
            </button>
            <button
              onClick={() => {
                setIsConfiguring(false);
                setApiKey('');
                setErrorMessage('');
                setStatus('idle');
              }}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img src="/bloxlink.png" alt="Bloxlink" className="w-8 h-8" />
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Bloxlink Integration</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Connected and active</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Status bar with actions */}
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${integration?.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="min-w-0">
              <p className="text-sm text-zinc-900 dark:text-white truncate">
                <span className="font-medium">{discordIntegration?.guildName}</span>
                <span className="text-zinc-400 ml-1.5 font-mono text-xs">{integration?.discordServerId}</span>
              </p>
              {integration?.lastUsed && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Last used {new Date(integration.lastUsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleTest}
              disabled={loading}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors"
            >
              Test
            </button>
            <button
              onClick={() => fetchIntegrationStatus()}
              disabled={loading}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
              title="Refresh"
            >
              <IconRefresh className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error banner */}
        {integration && integration.errorCount > 0 && integration.lastError && (
          <div className="flex items-center justify-between text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              <span>{integration.errorCount} error(s)</span>
              <span className="text-xs font-mono text-amber-500 truncate ml-1">— {integration.lastError}</span>
            </div>
            <button
              onClick={async () => {
                try {
                  await axios.post(`/api/workspace/${workspace?.groupId}/settings/bloxlink/clear-error`);
                  await fetchIntegrationStatus();
                } catch (error) {
                  console.error('Failed to clear error:', error);
                }
              }}
              className="text-xs text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Session Review DMs toggle */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Session Review DMs</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Send users a session summary when they leave the game</p>
          </div>
          <button
            onClick={async () => {
              try {
                const response = await axios.patch(`/api/workspace/${workspace?.groupId}/settings/bloxlink/configure`, {
                  notifyActivityReview: !integration?.notifyActivityReview,
                });
                if (response.data.success) {
                  setIntegration((prev) => prev ? { ...prev, notifyActivityReview: !prev.notifyActivityReview } : prev);
                }
              } catch (error) {
                console.error('Failed to toggle session review DMs:', error);
              }
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              integration?.notifyActivityReview ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                integration?.notifyActivityReview ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>

        {/* Remove */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2.5">
            <IconTrash className="w-4 h-4 text-red-500" />
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Remove Integration</p>
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

      {/* Remove modal */}
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
                Are you sure you want to remove the Bloxlink integration?
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your API key will be deleted and Discord DM notifications for user actions will stop working.
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
                onClick={handleDisconnect}
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
};

BloxlinkSettings.title = 'Bloxlink Integration';

export default BloxlinkSettings;
