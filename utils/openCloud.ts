const OPENCLOUD = "https://apis.roblox.com/cloud/v2";

interface OpenCloudMember {
  path: string;
  user: string;
  role: string;
  createTime: string;
  updateTime: string;
}

interface OpenCloudMembershipResponse {
  groupMemberships: OpenCloudMember[];
  nextPageToken?: string;
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
  const allMembers: GroupMember[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;
  while (true) {
    const url = new URL(`${OPENCLOUD}/groups/${groupId}/memberships`);
    url.searchParams.set("maxPageSize", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }
    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Roblox Open Cloud API error (${response.status}): ${body}`);
    }
    const data: OpenCloudMembershipResponse = await response.json();
    if (data.groupMemberships) {
      for (const membership of data.groupMemberships) {
        const userIdMatch = membership.user?.match(/users\/(\d+)/);
        const roleIdMatch = membership.role?.match(/roles\/(\d+)/);

        if (userIdMatch) {
          allMembers.push({
            userId: parseInt(userIdMatch[1]),
            roleId: roleIdMatch ? parseInt(roleIdMatch[1]) : 0,
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
  const url = new URL(`${OPENCLOUD}/groups/${groupId}/memberships`);
  url.searchParams.set("maxPageSize", "100");
  url.searchParams.set("filter", `role == 'groups/${groupId}/roles/${roleId}'`);
  const allMembers: GroupMember[] = [];
  let pageToken: string | undefined;
  while (true) {
    const requestUrl = new URL(url.toString());
    if (pageToken) {
      requestUrl.searchParams.set("pageToken", pageToken);
    }
    const response = await fetch(requestUrl.toString(), {
      headers: {
        "x-api-key": apiKey,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Roblox Open Cloud API error (${response.status}): ${body}`);
    }
    const data: OpenCloudMembershipResponse = await response.json();
    if (data.groupMemberships) {
      for (const membership of data.groupMemberships) {
        const userIdMatch = membership.user?.match(/users\/(\d+)/);
        if (userIdMatch) {
          allMembers.push({
            userId: parseInt(userIdMatch[1]),
            roleId: roleId,
          });
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
  private apiKey: string;
  private groupId: number;

  constructor(apiKey: string, groupId: number) {
    this.apiKey = apiKey;
    this.groupId = groupId;
  }

  async setUserRole(userId: number, roleId: number): Promise<RankingResponse> {
    try {
      const url = `${OPENCLOUD}/groups/${this.groupId}/memberships/${userId}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: `groups/${this.groupId}/roles/${roleId}`,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        let errorMessage = `Failed to update role (${response.status})`;
        try {
          const parsed = JSON.parse(body);
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
        return { success: false, error: errorMessage };
      }
      return { success: true, message: "Role updated successfully" };
    } catch (error: any) {
      return { success: false, error: error.message || "Open Cloud ranking request failed" };
    }
  }

  async getGroupRoles(): Promise<{ id: number; name: string; rank: number }[]> {
    const response = await fetch(
      `https://groups.roblox.com/v1/groups/${this.groupId}/roles`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch group roles: ${response.status}`);
    }
    const data = await response.json();
    return (data.roles || [])
      .map((r: any) => ({ id: r.id, name: r.name, rank: r.rank }))
      .sort((a: any, b: any) => a.rank - b.rank);
  }

  async getUserMembership(userId: number): Promise<{ roleId: number; rank: number } | null> {
    try {
      const url = `${OPENCLOUD}/groups/${this.groupId}/memberships?filter=user == 'users/${userId}'&maxPageSize=1`;
      const response = await fetch(url, {
        headers: { "x-api-key": this.apiKey },
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.groupMemberships?.length) return null;
      const membership = data.groupMemberships[0];
      const roleIdMatch = membership.role?.match(/roles\/(\d+)/);
      if (!roleIdMatch) return null;
      const roleId = parseInt(roleIdMatch[1]);
      const roles = await this.getGroupRoles();
      const role = roles.find(r => r.id === roleId);
      return { roleId, rank: role?.rank || 0 };
    } catch {
      return null;
    }
  }

  async promoteUser(userId: number): Promise<RankingResponse> {
    try {
      const [membership, roles] = await Promise.all([
        this.getUserMembership(userId),
        this.getGroupRoles(),
      ]);
      if (!membership) return { success: false, error: "User is not in the group" };
      const currentIdx = roles.findIndex(r => r.rank === membership.rank);
      if (currentIdx === -1 || currentIdx >= roles.length - 1) {
        return { success: false, error: "User is already at the highest rank" };
      }
      const nextRole = roles[currentIdx + 1];
      return this.setUserRole(userId, nextRole.id);
    } catch (error: any) {
      return { success: false, error: error.message || "Promotion failed" };
    }
  }

  async demoteUser(userId: number): Promise<RankingResponse> {
    try {
      const [membership, roles] = await Promise.all([
        this.getUserMembership(userId),
        this.getGroupRoles(),
      ]);
      if (!membership) return { success: false, error: "User is not in the group" };
      const nonGuestRoles = roles.filter(r => r.rank > 0);
      const currentIdx = nonGuestRoles.findIndex(r => r.rank === membership.rank);
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
      const lowestRole = roles.find(r => r.rank === 1);
      if (!lowestRole) return { success: false, error: "Could not find lowest rank" };
      return this.setUserRole(userId, lowestRole.id);
    } catch (error: any) {
      return { success: false, error: error.message || "Termination failed" };
    }
  }

  async setUserRank(userId: number, rankNumber: number): Promise<RankingResponse> {
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
