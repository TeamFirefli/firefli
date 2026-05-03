export type SessionType = 'shift' | 'training' | 'event' | 'other';

export function hasSessionPermission(
  permissions: string[],
  sessionType: string | null | undefined,
  action: 'see' | 'assign' | 'claim' | 'unscheduled' | 'scheduled' | 'manage' | 'notes' | 'assign_tag' | 'edit_concluded'
): boolean {
  if (permissions.includes('admin')) return true;
  
  const type = (sessionType || 'other').toLowerCase() as SessionType;
  const permissionString = `sessions_${type}_${action}`;
  
  return permissions.includes(permissionString);
}

export function canSeeSession(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'see');
}

export function canAssignUsers(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'assign');
}

export function canClaimSelf(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'claim');
}

export function canCreateUnscheduled(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'unscheduled');
}

export function canCreateScheduled(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'scheduled');
}

export function canManageSession(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'manage');
}

export function canAddNotes(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'notes');
}

export function canEditConcluded(permissions: string[], sessionType: string | null | undefined): boolean {
  return hasSessionPermission(permissions, sessionType, 'edit_concluded');
}

export function canCreateAnySession(permissions: string[]): boolean {
  if (permissions.includes('admin')) return true;
  
  const sessionTypes: SessionType[] = ['shift', 'training', 'event', 'other'];
  
  return sessionTypes.some(type => 
    permissions.includes(`sessions_${type}_scheduled`) || 
    permissions.includes(`sessions_${type}_unscheduled`)
  );
}
