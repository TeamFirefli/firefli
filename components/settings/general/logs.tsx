import axios from 'axios';
import React, { useEffect, useState, Fragment } from 'react';
import { workspacestate } from '@/state';
import { useRecoilState } from 'recoil';
import { IconSearch, IconRefresh, IconFilter, IconChevronDown, IconChevronLeft, IconChevronRight, IconUser, IconClock, IconPlus, IconPencil, IconTrash, IconSettings, IconActivity } from '@tabler/icons-react';
import { Popover, Transition } from '@headlessui/react';
import { FC } from '@/types/settingsComponent';

type AuditEntry = {
  id: number;
  userId?: string;
  userName?: string;
  action: string;
  entity?: string;
  details?: any;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  'document.create': 'Document Create',
  'document.update': 'Document Update',
  'document.delete': 'Document Delete',
  'session.create': 'Session Create',
  'session.create.scheduled': 'Session Create (Scheduled)',
  'session.create.unscheduled': 'Session Create (Unscheduled)',
  'session.delete': 'Session Delete',
  'session.delete.range': 'Session Delete (Range)',
  'session.tag.assign': 'Session Tag Assign',
  'session.tag.remove': 'Session Tag Remove',
  'SESSION_TAG_CREATED': 'Session Tag Create',
  'SESSION_TAG_UPDATED': 'Session Tag Update',
  'SESSION_TAG_DELETED': 'Session Tag Delete',
  'wall.post.create': 'Wall Create',
  'wall.post.delete': 'Wall Delete',
  'wall.post.react': 'Wall React',
  'container.create': 'Container Create',
  'container.update': 'Container Update',
  'container.delete': 'Container Delete',
  'userbook.create': 'Logbook Entry Create',
  'userbook.delete': 'Logbook Entry Delete',
  'userbook.redact': 'Logbook Entry Redact',
  'userbook.unredact': 'Logbook Entry Unredact',
  'policy.create': 'Policy Create',
  'policy.update': 'Policy Update',
  'policy.delete': 'Policy Delete',
  'policy.acknowledge': 'Policy Acknowledge',
  'policy.link_generated': 'Policy Link Generated',
  'policy.link_created': 'Policy Link Created',
  'policy.link_updated': 'Policy Link Updated',
  'policy.link_deleted': 'Policy Link Deleted',
  'notice.approve': 'Notice Approve',
  'notice.deny': 'Notice Deny',
  'notice.cancel': 'Notice Cancel',
  'activity.adjustment': 'Activity Adjustment',
  'activity.quota.create': 'Quota Create',
  'activity.quota.delete': 'Quota Delete',
  'activity.quota.signoff': 'Quota Signoff',
  'activity.quota.complete': 'Quota Complete',
  'activity.quota.uncomplete': 'Quota Uncomplete',
  'recommendation.create': 'Recommendation Create',
  'recommendation.edit': 'Recommendation Edit',
  'recommendation.status': 'Recommendation Status Change',
  'recommendation.delete': 'Recommendation Delete',
  'discord.integration.configure': 'Discord Integration Configure',
  'discord.integration.remove': 'Discord Integration Remove',
  'workspace.ownership.transfer': 'Workspace Ownership Transfer',
  'update_announcement': 'Announcement Update',
  'settings.update': 'Settings Update',
  'settings.general.home.update': 'Settings - Home',
  'settings.general.color.update': 'Settings - Theme Colour',
  'settings.general.sessionColors.update': 'Settings - Session Colours',
  'settings.general.leaderboard.update': 'Settings - Leaderboard',
  'settings.general.allies.update': 'Settings - Allies',
  'settings.general.sessions.update': 'Settings - Sessions',
  'settings.general.policies.update': 'Settings - Policies',
  'settings.activity.role.update': 'Settings - Activity Role',
  'settings.activity.idleTime.update': 'Settings - Idle Time',
  'settings.activity.lRole.update': 'Settings - Leaderboard Role',
  'settings.roles.create': 'Role Create',
  'settings.roles.update': 'Role Update',
  'settings.roles.delete': 'Role Delete',
  'settings.users.add': 'User Add',
  'settings.users.update': 'User Update',
  'settings.users.resync': 'User Resync',
};

const PERMISSION_LABELS: Record<string, string> = {
  'view_wall': 'View wall',
  'post_on_wall': 'Post on wall',
  'react_wall': 'React to wall posts',
  'delete_wall_posts': 'Delete wall posts',
  'sessions_shift_see': 'Shift Sessions - See',
  'sessions_shift_assign': 'Shift Sessions - Assign',
  'sessions_shift_claim': 'Shift Sessions - Claim',
  'sessions_shift_unscheduled': 'Shift Sessions - Create Unscheduled',
  'sessions_shift_scheduled': 'Shift Sessions - Create Scheduled',
  'sessions_shift_manage': 'Shift Sessions - Manage',
  'sessions_shift_notes': 'Shift Sessions - Add Notes',
  'sessions_shift_assign_tag': 'Shift Sessions - Assign Tag',
  'sessions_training_see': 'Training Sessions - See',
  'sessions_training_assign': 'Training Sessions - Assign',
  'sessions_training_claim': 'Training Sessions - Claim',
  'sessions_training_unscheduled': 'Training Sessions - Create Unscheduled',
  'sessions_training_scheduled': 'Training Sessions - Create Scheduled',
  'sessions_training_manage': 'Training Sessions - Manage',
  'sessions_training_notes': 'Training Sessions - Add Notes',
  'sessions_training_assign_tag': 'Training Sessions - Assign Tag',
  'sessions_event_see': 'Event Sessions - See',
  'sessions_event_assign': 'Event Sessions - Assign',
  'sessions_event_claim': 'Event Sessions - Claim',
  'sessions_event_unscheduled': 'Event Sessions - Create Unscheduled',
  'sessions_event_scheduled': 'Event Sessions - Create Scheduled',
  'sessions_event_manage': 'Event Sessions - Manage',
  'sessions_event_notes': 'Event Sessions - Add Notes',
  'sessions_event_assign_tag': 'Event Sessions - Assign Tag',
  'sessions_other_see': 'Other Sessions - See',
  'sessions_other_assign': 'Other Sessions - Assign',
  'sessions_other_claim': 'Other Sessions - Claim',
  'sessions_other_unscheduled': 'Other Sessions - Create Unscheduled',
  'sessions_other_scheduled': 'Other Sessions - Create Scheduled',
  'sessions_other_manage': 'Other Sessions - Manage',
  'sessions_other_notes': 'Other Sessions - Add Notes',
  'sessions_other_assign_tag': 'Other Sessions - Assign Tag',
  'view_members': 'View members',
  'view_directory': 'View directory',
  'use_views': 'Use saved views',
  'create_views': 'Create views',
  'edit_views': 'Edit views',
  'delete_views': 'Delete views',
  'export_views': 'Export views',
  'use_mass_actions': 'Use mass actions',
  'create_docs': 'Create docs',
  'edit_docs': 'Edit docs',
  'delete_docs': 'Delete docs',
  'create_policies': 'Create policies',
  'edit_policies': 'Edit policies',
  'delete_policies': 'Delete policies',
  'view_compliance': 'View compliance',
  'create_notices': 'Create notices',
  'approve_notices': 'Approve notices',
  'manage_notices': 'Manage notices',
  'create_quotas': 'Create quotas',
  'delete_quotas': 'Delete quotas',
  'signoff_custom_quotas': 'Signoff custom quotas',
  'view_member_profiles': 'Profiles - View',
  'edit_member_details': 'Info - Edit details',
  'record_notices': 'Notices - Record approved',
  'activity_adjustments': 'Activity - Adjustments',
  'view_logbook': 'Logbook - See Entries',
  'logbook_redact': 'Logbook - Redact Entries',
  'logbook_note': 'Logbook - Note',
  'logbook_warning': 'Logbook - Warning',
  'logbook_promotion': 'Logbook - Promotion',
  'logbook_demotion': 'Logbook - Demotion',
  'logbook_termination': 'Logbook - Termination',
  'logbook_resignation': 'Logbook - Resignation',
  'rank_users': 'Logbook - Use Ranking Integration',
  'create_alliances': 'Create alliances',
  'delete_alliances': 'Delete alliances',
  'represent_alliance': 'Represent alliance',
  'edit_alliance_details': 'Edit alliance details',
  'add_alliance_notes': 'Add notes',
  'edit_alliance_notes': 'Edit notes',
  'delete_alliance_notes': 'Delete notes',
  'add_alliance_visits': 'Add visits',
  'edit_alliance_visits': 'Edit visits',
  'delete_alliance_visits': 'Delete visits',
  'view_moderation': 'View moderation',
  'create_moderation_cases': 'Create moderation cases',
  'edit_moderation_cases': 'Edit moderation cases',
  'delete_moderation_cases': 'Delete moderation cases',
  'execute_punishments': 'Execute punishments',
  'revoke_punishments': 'Revoke punishments',
  'upload_evidence': 'Upload evidence',
  'delete_evidence': 'Delete evidence',
  'view_recommendations': 'View recommendations',
  'post_recommendations': 'Post recommendations',
  'comment_recommendations': 'Comment on recommendations',
  'vote_recommendations': 'Vote on recommendations',
  'manage_recommendations': 'Manage recommendations',
  'delete_recommendations': 'Delete recommendations',
  'admin': 'Admin (Manage workspace)',
  'reset_activity': 'Reset activity',
  'view_audit_logs': 'View audit logs',
  'manage_apikeys': 'Create API keys',
  'manage_features': 'Manage features',
  'workspace_customisation': 'Workspace customisation',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  'recurring': 'Recurring',
  'shift': 'Shift',
  'training': 'Training',
  'event': 'Event',
  'other': 'Other',
};

const getActionLabel = (action: string) => {
  if (!action) return '';
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .split(/[._]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
};

const formatValue = (v: any, maxLength: number = 100) => {
  if (v === null) return <span className="text-zinc-400 dark:text-zinc-500 italic">null</span>;
  if (v === undefined) return <span className="text-zinc-400 dark:text-zinc-500 italic">undefined</span>;
  if (typeof v === 'boolean') return <span className="font-medium">{v ? 'true' : 'false'}</span>;
  if (typeof v === 'number') return <span className="font-medium">{v}</span>;
  if (typeof v === 'string') {
    if (v.length === 0) return <span className="text-zinc-400 dark:text-zinc-500 italic">(empty)</span>;
    const truncated = v.length > maxLength ? v.slice(0, maxLength) + '...' : v;
    return <span>{truncated}</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-zinc-400 dark:text-zinc-500 italic">[]</span>;
    return <span className="font-mono">[{v.length} items]</span>;
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return <span className="text-zinc-400 dark:text-zinc-500 italic">{'{}'}</span>;
    return <span className="font-mono">{'{'}{keys.slice(0, 3).join(', ')}{keys.length > 3 ? '...' : ''}{'}'}</span>;
  }
  return <span className="font-mono">{String(v)}</span>;
};

const itemKey = (x: any) => {
  if (x === null || x === undefined) return String(x);
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (typeof x === 'object') {
    if (x.id) return String(x.id);
    if (x.name) return String(x.name);
    return JSON.stringify(x);
  }
  return String(x);
};

const renderDetails = (details: any, action?: string) => {
  if (!details) return <span className="text-xs text-zinc-500 dark:text-zinc-400">-</span>;
  if (typeof details === 'string' || typeof details === 'number') {
    return <div className="text-sm">{formatValue(details, 200)}</div>;
  }

  const hasBefore = Object.prototype.hasOwnProperty.call(details, 'before');
  const hasAfter = Object.prototype.hasOwnProperty.call(details, 'after');
  
  if (hasBefore || hasAfter) {
    const before = details.before || {};
    const after = details.after || {};
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const changes: any[] = [];
    
    if (details.roleName) {
      changes.push({
        key: 'roleName',
        type: 'roleName',
        value: details.roleName
      });
    }
    
    for (const key of allKeys) {
      const beforeVal = before[key];
      const afterVal = after[key];
      if (JSON.stringify(beforeVal) === JSON.stringify(afterVal)) continue;
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === '__v') continue;
      if (key === 'permissions' && Array.isArray(beforeVal) && Array.isArray(afterVal)) {
        const beforeSet = new Set(beforeVal);
        const afterSet = new Set(afterVal);
        const added = afterVal.filter((p: string) => !beforeSet.has(p));
        const removed = beforeVal.filter((p: string) => !afterSet.has(p));
        
        if (added.length > 0 || removed.length > 0) {
          changes.push({
            key: 'permissions',
            type: 'permissions',
            added: added.map((p: string) => PERMISSION_LABELS[p] || p),
            removed: removed.map((p: string) => PERMISSION_LABELS[p] || p)
          });
        }
        continue;
      }
      
      if (key === 'sessionColors' && typeof beforeVal === 'object' && typeof afterVal === 'object' && beforeVal !== null && afterVal !== null) {
        const allSessionKeys = Array.from(new Set([...Object.keys(beforeVal), ...Object.keys(afterVal)]));
        const colorChanges: any[] = [];
        
        for (const sessionKey of allSessionKeys) {
          if (beforeVal[sessionKey] !== afterVal[sessionKey]) {
            colorChanges.push({
              type: sessionKey,
              label: SESSION_TYPE_LABELS[sessionKey] || sessionKey,
              before: beforeVal[sessionKey],
              after: afterVal[sessionKey]
            });
          }
        }
        
        if (colorChanges.length > 0) {
          changes.push({
            key: 'sessionColors',
            type: 'sessionColors',
            colorChanges
          });
        }
        continue;
      }
      
      if (Array.isArray(beforeVal) && Array.isArray(afterVal)) {
        const maxLength = Math.max(beforeVal.length, afterVal.length);
        for (let i = 0; i < maxLength; i++) {
          if (JSON.stringify(beforeVal[i]) !== JSON.stringify(afterVal[i])) {
            if (typeof beforeVal[i] === 'object' && typeof afterVal[i] === 'object') {
              const nestedKeys = Array.from(new Set([
                ...Object.keys(beforeVal[i] || {}),
                ...Object.keys(afterVal[i] || {})
              ]));
              for (const nestedKey of nestedKeys) {
                if (JSON.stringify(beforeVal[i]?.[nestedKey]) !== JSON.stringify(afterVal[i]?.[nestedKey])) {
                  changes.push({
                    key: `${key}[${i}].${nestedKey}`,
                    before: beforeVal[i]?.[nestedKey],
                    after: afterVal[i]?.[nestedKey]
                  });
                }
              }
            } else {
              changes.push({
                key: `${key}[${i}]`,
                before: beforeVal[i],
                after: afterVal[i]
              });
            }
          }
        }
      } else if (typeof beforeVal === 'object' && typeof afterVal === 'object' && beforeVal !== null && afterVal !== null) {
        const nestedKeys = Array.from(new Set([...Object.keys(beforeVal), ...Object.keys(afterVal)]));
        let hasNestedChange = false;
        for (const nestedKey of nestedKeys) {
          if (JSON.stringify(beforeVal[nestedKey]) !== JSON.stringify(afterVal[nestedKey])) {
            hasNestedChange = true;
            changes.push({
              key: `${key}.${nestedKey}`,
              before: beforeVal[nestedKey],
              after: afterVal[nestedKey]
            });
          }
        }
        if (!hasNestedChange) {
          changes.push({ key, before: beforeVal, after: afterVal });
        }
      } else {
        changes.push({ key, before: beforeVal, after: afterVal });
      }
    }
    
    if (changes.length === 0) {
      return <span className="text-xs text-zinc-500 dark:text-zinc-400 italic">No changes detected</span>;
    }
    
    return (
      <div className="space-y-2">
        {changes.map((change, idx) => {
          if (change.type === 'roleName') {
            return (
              <div key={change.key} className="text-sm mb-2">
                <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Role: {change.value}
                </div>
              </div>
            );
          }
          
          if (change.type === 'permissions') {
            return (
              <div key={change.key} className="text-sm">
                <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Permissions
                </div>
                <div className="space-y-2">
                  {change.removed && change.removed.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1.5">
                      <div className="text-[10px] text-red-700 dark:text-red-400 mb-1">Removed</div>
                      <div className="text-xs text-red-900 dark:text-red-200">
                        {change.removed.join(', ')}
                      </div>
                    </div>
                  )}
                  {change.added && change.added.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1.5">
                      <div className="text-[10px] text-green-700 dark:text-green-400 mb-1">Added</div>
                      <div className="text-xs text-green-900 dark:text-green-200">
                        {change.added.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          if (change.type === 'sessionColors') {
            return (
              <div key={change.key} className="text-sm">
                <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Session Colours
                </div>
                <div className="space-y-2">
                  {change.colorChanges.map((colorChange: any) => (
                    <div key={colorChange.type} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 w-20">
                        {colorChange.label}:
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                          <div className={`w-4 h-4 rounded ${colorChange.before}`}></div>
                          <span className="text-[10px] text-red-700 dark:text-red-300">{colorChange.before}</span>
                        </div>
                        <span className="text-zinc-400 dark:text-zinc-500">→</span>
                        <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1">
                          <div className={`w-4 h-4 rounded ${colorChange.after}`}></div>
                          <span className="text-[10px] text-green-700 dark:text-green-300">{colorChange.after}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          
          return (
            <div key={change.key + idx} className="text-sm">
              <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1 capitalize">
                {change.key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
              </div>
              <div className="flex items-start gap-2">
                <div className="flex-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                  <div className="text-[10px] text-red-700 dark:text-red-400 mb-0.5">Before</div>
                  <div className="text-xs text-red-900 dark:text-red-200">{formatValue(change.before, 150)}</div>
                </div>
                <div className="text-zinc-400 dark:text-zinc-500 self-center">→</div>
                <div className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1">
                  <div className="text-[10px] text-green-700 dark:text-green-400 mb-0.5">After</div>
                  <div className="text-xs text-green-900 dark:text-green-200">{formatValue(change.after, 150)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (typeof details === 'object') {
    const entries = Object.entries(details).filter(([key]) => 
      key !== 'id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt'
    );
    
    if (entries.length === 0) {
      return <span className="text-xs text-zinc-500 dark:text-zinc-400 italic">No details</span>;
    }
    
    return (
      <div className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300 capitalize">
              {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}:
            </span>{' '}
            <span className="text-zinc-600 dark:text-zinc-400">{formatValue(value, 150)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-sm text-zinc-600 dark:text-zinc-400">{String(details)}</span>;
};
const getActionCategory = (action: string): 'create' | 'update' | 'delete' | 'other' => {
  if (!action) return 'other';
  if (/\.(create|add|post|approve|claim|assign|signoff|execute|upload|invite)(\.|$)/.test(action)) return 'create';
  if (/\.(update|edit|change|set|toggle|move|rename|react|comment|vote|note|warning|promotion|demotion|termination|resignation|redact)(\.|$)/.test(action)) return 'update';
  if (/\.(delete|remove|revoke|reset)(\.|$)/.test(action)) return 'delete';
  return 'other';
};

const CATEGORY_STYLES = {
  create: { badge: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800', icon: IconPlus },
  update: { badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: IconPencil },
  delete: { badge: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800', icon: IconTrash },
  other:  { badge: 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-600', icon: IconSettings },
};

const formatRelativeTime = (date: Date): string => {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
};

const PAGE_SIZE = 25;

const AuditLogs: FC<{ triggerToast?: any }> = () => {
  const [workspace] = useRecoilState(workspacestate);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [knownActions, setKnownActions] = useState<Set<string>>(() => new Set(Object.keys(ACTION_LABELS)));
  const [actionSearch, setActionSearch] = useState('');

  const fetchLogs = async (opts?: { page?: number; search?: string; actionFilter?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    const a = opts?.actionFilter ?? actionFilter;
    setLoading(true);
    try {
      const params: any = { limit: PAGE_SIZE, page: p };
      if (a === 'session.create') {
        params.search = (s ? s + ' ' : '') + 'session.create';
      } else if (a) {
        params.action = a;
        if (s) params.search = s;
      } else if (s) {
        params.search = s;
      }

      const res = await axios.get(`/api/workspace/${workspace.groupId}/audit`, { params });
      if (res.data?.success) {
        const newRows: AuditEntry[] = res.data.rows || [];
        setRows(newRows);
        setTotal(res.data.total || 0);
        setKnownActions((prev) => {
          const next = new Set(prev);
          newRows.forEach((r) => { if (r.action) next.add(r.action); });
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs({ page: 0 });
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      fetchLogs({ page: 0, search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goToPage = (p: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, p));
    setPage(clamped);
    setExpandedId(null);
    fetchLogs({ page: clamped });
  };

  const startIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const endIdx = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconSearch className="w-4 h-4 text-zinc-400" />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs..."
            className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-200 placeholder-zinc-500 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all text-sm"
          />
        </div>

        <Popover className="relative">
          {({ open, close }) => (
            <>
              <Popover.Button className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${open ? 'bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white ring-2 ring-primary/50' : 'bg-zinc-50 dark:bg-zinc-700/50 border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'}`}>
                <IconFilter className="w-4 h-4" />
                <span>{actionFilter ? (ACTION_LABELS[actionFilter] || getActionLabel(actionFilter)) : 'All actions'}</span>
              </Popover.Button>
              <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                <Popover.Panel className="absolute z-50 mt-2 w-72 max-w-[90vw] origin-top-right right-0 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xl top-full flex flex-col max-h-[60vh]">
                  <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <IconSearch className="w-4 h-4 text-zinc-400" />
                      </div>
                      <input
                        autoFocus
                        value={actionSearch}
                        onChange={(e) => setActionSearch(e.target.value)}
                        placeholder="Search actions..."
                        className="block w-full pl-8 pr-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-200 placeholder-zinc-500 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <div className="overflow-auto p-1.5">
                    <button onClick={() => { setActionFilter(''); setActionSearch(''); setPage(0); fetchLogs({ page: 0, actionFilter: '' }); close(); }} className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${!actionFilter ? 'bg-primary/10 text-primary font-medium' : 'text-zinc-700 dark:text-zinc-200'}`}>All actions</button>
                    <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
                    {(() => {
                      const q = actionSearch.trim().toLowerCase();
                      const items = Array.from(knownActions)
                        .map((k) => ({ key: k, label: getActionLabel(k) }))
                        .filter(({ key, label }) => !q || key.toLowerCase().includes(q) || label.toLowerCase().includes(q))
                        .sort((a, b) => a.label.localeCompare(b.label));
                      if (items.length === 0) {
                        return <div className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No matching actions</div>;
                      }
                      return items.map(({ key, label }) => (
                        <button key={key} onClick={() => { setActionFilter(key); setActionSearch(''); setPage(0); fetchLogs({ page: 0, actionFilter: key }); close(); }} className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${actionFilter === key ? 'bg-primary/10 text-primary font-medium' : 'text-zinc-700 dark:text-zinc-200'}`}>{label}</button>
                      ));
                    })()}
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>

        <button
          onClick={() => fetchLogs()}
          title="Refresh"
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border bg-zinc-50 dark:bg-zinc-700/50 border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-all disabled:opacity-50"
        >
          <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="p-12 text-center">
            <IconRefresh className="w-6 h-6 animate-spin mx-auto text-zinc-400 mb-2" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading audit logs...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <IconActivity className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No audit entries found</p>
            {(search || actionFilter) && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-700/60">
            {rows.map((r) => {
              const category = getActionCategory(r.action);
              const style = CATEGORY_STYLES[category];
              const Icon = style.icon;
              const isExpanded = expandedId === r.id;
              const createdAt = new Date(r.createdAt);
              const hasDetails = r.details && (typeof r.details === 'object' ? Object.keys(r.details).length > 0 : true);

              return (
                <li key={r.id} className="group">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
                  >
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${style.badge}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{getActionLabel(r.action)}</span>
                        {r.entity && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{r.entity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <IconUser className="w-3 h-3" />
                          {r.userName || r.userId || 'System'}
                        </span>
                        <span className="inline-flex items-center gap-1" title={createdAt.toLocaleString()}>
                          <IconClock className="w-3 h-3" />
                          {formatRelativeTime(createdAt)}
                        </span>
                      </div>
                    </div>
                    {hasDetails && (
                      <IconChevronDown className={`flex-shrink-0 w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  {isExpanded && hasDetails && (
                    <div className="px-4 pb-4 pl-16 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-700/60">
                      <div className="pt-3">
                        {renderDetails(r.details, r.action)}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">
            Showing <span className="font-medium text-zinc-900 dark:text-white">{startIdx}</span>-<span className="font-medium text-zinc-900 dark:text-white">{endIdx}</span> of <span className="font-medium text-zinc-900 dark:text-white">{total}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <IconChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="px-3 text-sm text-zinc-600 dark:text-zinc-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

AuditLogs.title = 'Audit Logs';

export default AuditLogs;
