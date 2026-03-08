import { OpenCloud } from "@relatiohq/opencloud";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createClient(apiKey: string): OpenCloud {
  return new OpenCloud({
    apiKey,
    retry: {
      attempts: 6,
      backoff: "exponential",
    },
  });
}

function extractId(path: string, resource: string): number | null {
  const match = path.match(new RegExp(`${resource}/(\\d+)`));
  return match ? parseInt(match[1]) : null;
}

interface CloudV2UserInfo {
  username: string;
  displayName: string;
}

interface CloudV2BatchResult {
  resolved: Map<number, CloudV2UserInfo>;
  notFound: number[];
}

export async function fetchCloudV2UserInfoBatch(
  userIds: number[],
  apiKey: string
): Promise<CloudV2BatchResult> {
  const resolved = new Map<number, CloudV2UserInfo>();
  const notFound: number[] = [];
  if (userIds.length === 0) return { resolved, notFound };

  const client = createClient(apiKey);
  const BATCH_DELAY = 100;

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    try {
      const user = await client.users.get(String(userId));
      if (user.name && user.displayName) {
        resolved.set(userId, {
          username: user.name.replace(/^@/, ""),
          displayName: user.displayName,
        });
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes("404")) {
        notFound.push(userId);
      } else {
        console.error(`[CloudV2] Error fetching user ${userId}:`, err);
      }
    }

    if (i < userIds.length - 1) {
      await delay(BATCH_DELAY);
    }
  }

  return { resolved, notFound };
}

export interface GroupMember {
  userId: number;
  roleId: number;
}

export async function fetchOpenCloudGroupMembers(
  groupId: number,
  apiKey: string,
  maxPages: number = 0
): Promise<{ members: GroupMember[] }> {
  const client = createClient(apiKey);
  const allMembers: GroupMember[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  while (true) {
    const data = await client.groups.listGroupMemberships(String(groupId), {
      maxPageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    if (data.groupMemberships) {
      for (const membership of data.groupMemberships) {
        const userId = extractId(membership.user ?? "", "users");
        const roleId = extractId(membership.role ?? "", "roles");

        if (userId !== null) {
          allMembers.push({
            userId,
            roleId: roleId ?? 0,
          });
        }
      }
    }

    pageCount++;
    if (maxPages > 0 && pageCount >= maxPages) break;
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return { members: allMembers };
}

export async function fetchOpenCloudRoleMembers(
  groupId: number,
  roleId: number,
  apiKey: string
): Promise<GroupMember[]> {
  const client = createClient(apiKey);
  const allMembers: GroupMember[] = [];
  let pageToken: string | undefined;

  while (true) {
    const data = await client.groups.listGroupMemberships(String(groupId), {
      maxPageSize: 100,
      filter: `role == 'groups/${groupId}/roles/${roleId}'`,
      ...(pageToken ? { pageToken } : {}),
    });

    if (data.groupMemberships) {
      for (const membership of data.groupMemberships) {
        const userId = extractId(membership.user ?? "", "users");
        if (userId !== null) {
          allMembers.push({ userId, roleId });
        }
      }
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return allMembers;
}

export async function getWorkspaceRobloxApiKey(
  groupId: number
): Promise<string | null> {
  const prisma = (await import("./database")).default;

  const services = await prisma.workspaceExternalServices.findUnique({
    where: { workspaceGroupId: groupId },
    select: { robloxApiKey: true },
  });

  return services?.robloxApiKey || null;
}

export interface RankingResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export class RobloxCloudRankingAPI {
  private client: OpenCloud;
  private groupId: number;

  constructor(apiKey: string, groupId: number) {
    this.client = createClient(apiKey);
    this.groupId = groupId;
  }

  async setUserRole(userId: number, roleId: number): Promise<RankingResponse> {
    try {
      await this.client.groups.updateGroupMembership(
        String(this.groupId),
        String(userId),
        String(roleId)
      );
      const roles = await this.getGroupRoles();
      const role = roles.find(r => r.id === roleId);
      const rankNumber = role?.rank || 0;
      const prisma = (await import("./database")).default;
      await prisma.rank.upsert({
        where: {
          userId_workspaceGroupId: {
            userId: BigInt(userId),
            workspaceGroupId: this.groupId,
          },
        },
        update: {
          rankId: BigInt(rankNumber),
          roleId: BigInt(roleId),
        },
        create: {
          userId: BigInt(userId),
          workspaceGroupId: this.groupId,
          rankId: BigInt(rankNumber),
          roleId: BigInt(roleId),
        },
      });
      
      console.log(`[OpenCloud] Updated stored rank for user ${userId}: rankId=${rankNumber}, roleId=${roleId}`);
      
      return { success: true, message: "Role updated successfully" };
    } catch (error: any) {
      return { success: false, error: error.message || "Open Cloud ranking request failed" };
    }
  }

  async getGroupRoles(): Promise<{ id: number; name: string; rank: number }[]> {
    const data = await this.client.groups.listGroupRoles(String(this.groupId));
    return (data.groupRoles || [])
      .map((r: any) => {
        const id = extractId(r.path ?? r.id ?? "", "roles") ?? 0;
        return { id, name: r.displayName ?? "", rank: r.rank ?? 0 };
      })
      .sort((a: any, b: any) => a.rank - b.rank);
  }

  async getUserMembership(userId: number): Promise<{ roleId: number; rank: number } | null> {
    try {
      const data = await this.client.groups.listGroupMemberships(String(this.groupId), {
        filter: `user == 'users/${userId}'`,
        maxPageSize: 1,
      });
      if (!data.groupMemberships?.length) return null;
      const membership = data.groupMemberships[0];
      const roleId = extractId(membership.role ?? "", "roles");
      if (roleId === null) return null;
      const roles = await this.getGroupRoles();
      const role = roles.find(r => r.id === roleId);
      return { roleId, rank: role?.rank || 0 };
    } catch {
      return null;
    }
  }

  async promoteUser(userId: number): Promise<RankingResponse> {
    try {
      const roles = await this.getGroupRoles();
      const nonGuestRoles = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank);
      const prisma = (await import("./database")).default;
      const userRank = await prisma.rank.findFirst({
        where: { userId: BigInt(userId), workspaceGroupId: this.groupId },
      });
      
      if (!userRank) {
        return { success: false, error: "User rank not found in database" };
      }
      
      const storedRoleId = userRank.roleId ? Number(userRank.roleId) : null;
      const storedRankNumber = Number(userRank.rankId);
      let currentRole;
      console.log(`[Promote] Stored values for user ${userId}: rankId=${storedRankNumber}, roleId=${storedRoleId}`);
      console.log(`[Promote] Available roles for group ${this.groupId}:`, roles.map(r => ({ id: r.id, rank: r.rank, name: r.name })));
      if (storedRoleId) {
        currentRole = roles.find(r => r.id === storedRoleId);
        console.log(`[Promote] Looking for roleId ${storedRoleId}: ${currentRole ? 'found' : 'not found'}`);
      }
      
      if (!currentRole && storedRankNumber <= 255) {
        currentRole = roles.find(r => r.rank === storedRankNumber);
        console.log(`[Promote] Looking for rankNumber ${storedRankNumber}: ${currentRole ? 'found' : 'not found'}`);
      }
      if (!currentRole) {
        console.log(`[Promote] Stored role not found, fetching live data from Roblox for user ${userId}`);
        const membership = await this.getUserMembership(userId);
        if (membership) {
          currentRole = roles.find(r => r.id === membership.roleId);
          if (currentRole) {
            await prisma.rank.update({
              where: {
                userId_workspaceGroupId: {
                  userId: BigInt(userId),
                  workspaceGroupId: this.groupId,
                },
              },
              data: {
                rankId: BigInt(currentRole.rank),
                roleId: BigInt(membership.roleId),
              },
            });
            console.log(`[Promote] Updated stale data: rankId=${currentRole.rank}, roleId=${membership.roleId}`);
          }
        }
        
        if (!currentRole) {
          return { success: false, error: `User role not found. Stored: rankId=${storedRankNumber}, roleId=${storedRoleId}. Available role IDs: ${roles.map(r => r.id).join(', ')}. User may not be in the group.` };
        }
      }
      
      const currentRankNumber = currentRole.rank;
      const currentIdx = nonGuestRoles.findIndex(r => r.rank === currentRankNumber);
      
      if (currentIdx === -1) {
        return { success: false, error: `Current rank ${currentRankNumber} not found in non-guest roles` };
      }
      
      if (currentIdx >= nonGuestRoles.length - 1) {
        return { success: false, error: "User is already at the highest rank" };
      }
      const nextRole = nonGuestRoles[currentIdx + 1];
      return this.setUserRole(userId, nextRole.id);
    } catch (error: any) {
      return { success: false, error: error.message || "Promotion failed" };
    }
  }

  async demoteUser(userId: number): Promise<RankingResponse> {
    try {
      const roles = await this.getGroupRoles();
      const nonGuestRoles = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank);
      const prisma = (await import("./database")).default;
      const userRank = await prisma.rank.findFirst({
        where: { userId: BigInt(userId), workspaceGroupId: this.groupId },
      });
      
      if (!userRank) {
        return { success: false, error: "User rank not found in database" };
      }
      
      const storedRoleId = userRank.roleId ? Number(userRank.roleId) : null;
      const storedRankNumber = Number(userRank.rankId);
      let currentRole;
      console.log(`[Demote] Stored values for user ${userId}: rankId=${storedRankNumber}, roleId=${storedRoleId}`);
      console.log(`[Demote] Available roles for group ${this.groupId}:`, roles.map(r => ({ id: r.id, rank: r.rank, name: r.name })));
      if (storedRoleId) {
        currentRole = roles.find(r => r.id === storedRoleId);
        console.log(`[Demote] Looking for roleId ${storedRoleId}: ${currentRole ? 'found' : 'not found'}`);
      }
      
      if (!currentRole && storedRankNumber <= 255) {
        currentRole = roles.find(r => r.rank === storedRankNumber);
        console.log(`[Demote] Looking for rankNumber ${storedRankNumber}: ${currentRole ? 'found' : 'not found'}`);
      }
      
      if (!currentRole) {
        console.log(`[Demote] Stored role not found, fetching live data from Roblox for user ${userId}`);
        const membership = await this.getUserMembership(userId);
        if (membership) {
          currentRole = roles.find(r => r.id === membership.roleId);
          if (currentRole) {
            await prisma.rank.update({
              where: {
                userId_workspaceGroupId: {
                  userId: BigInt(userId),
                  workspaceGroupId: this.groupId,
                },
              },
              data: {
                rankId: BigInt(currentRole.rank),
                roleId: BigInt(membership.roleId),
              },
            });
            console.log(`[Demote] Updated stale data: rankId=${currentRole.rank}, roleId=${membership.roleId}`);
          }
        }
        
        if (!currentRole) {
          return { success: false, error: `User role not found. Stored: rankId=${storedRankNumber}, roleId=${storedRoleId}. Available role IDs: ${roles.map(r => r.id).join(', ')}. User may not be in the group.` };
        }
      }
      const currentRankNumber = currentRole.rank;
      const currentIdx = nonGuestRoles.findIndex(r => r.rank === currentRankNumber);
      
      if (currentIdx === -1) {
        return { success: false, error: `Current rank ${currentRankNumber} not found in non-guest roles` };
      }
      
      if (currentIdx <= 0) {
        return { success: false, error: "User is already at the lowest rank" };
      }

      const prevRole = nonGuestRoles[currentIdx - 1];
      return this.setUserRole(userId, prevRole.id);
    } catch (error: any) {
      return { success: false, error: error.message || "Demotion failed" };
    }
  }

  async terminateUser(userId: number): Promise<RankingResponse> {
    try {
      const roles = await this.getGroupRoles();
      const nonGuestRoles = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank);
      const lowestRole = nonGuestRoles[0];
      if (!lowestRole) return { success: false, error: "Could not find lowest non-guest rank" };
      return this.setUserRole(userId, lowestRole.id);
    } catch (error: any) {
      return { success: false, error: error.message || "Termination failed" };
    }
  }

  async setUserRank(userId: number, roleId: number): Promise<RankingResponse> {
    return this.setUserRole(userId, roleId);
  }

  async setUserRankByNumber(userId: number, rankNumber: number): Promise<RankingResponse> {
    try {
      const roles = await this.getGroupRoles();
      const targetRole = roles.find(r => r.rank === rankNumber);
      if (!targetRole) {
        return { success: false, error: `No role found with rank number ${rankNumber}` };
      }
      return this.setUserRole(userId, targetRole.id);
    } catch (error: any) {
      return { success: false, error: error.message || "Rank change failed" };
    }
  }
}
