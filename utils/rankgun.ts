import axios from "axios";

interface RankGun {
  apiKey: string;
  workspaceId: string;
}

export interface RankGunResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export class RankGunAPI {
  private apiKey: string;
  private workspaceId: string;
  private baseURL = "https://api.rankgun.works";

  constructor(config: RankGun) {
    this.apiKey = config.apiKey;
    this.workspaceId = config.workspaceId;
  }

  private async makeRequest(
    endpoint: string,
    data: any
  ): Promise<RankGunResponse> {
    try {
      const response = await axios.post(`${this.baseURL}${endpoint}`, data, {
        headers: {
          "api-token": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      return {
        success: true,
        message: response.data.message || "Operation completed successfully",
      };
    } catch (error: any) {
      let errorMessage = "RankGun API request failed";

      if (error.response?.data) {
        const data = error.response.data;
        if (data.message) {
          errorMessage = data.message;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.code) {
          switch (data.code) {
            case "PERMISSION_DENIED":
              errorMessage = "Insufficient permissions";
              break;
            case "USER_NOT_FOUND":
              errorMessage = "User not found";
              break;
            case "WORKSPACE_NOT_FOUND":
              errorMessage = "Workspace not found";
              break;
            default:
              errorMessage = data.message || `Error: ${data.code}`;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async promoteUser(userId: number, _groupId: string): Promise<RankGunResponse> {
    return this.makeRequest("/roblox/promote", {
      user_id: userId,
      workspace_id: this.workspaceId,
    });
  }

  async demoteUser(userId: number, _groupId: string): Promise<RankGunResponse> {
    return this.makeRequest("/roblox/demote", {
      user_id: userId,
      workspace_id: this.workspaceId,
    });
  }

  async terminateUser(userId: number, _groupId: string): Promise<RankGunResponse> {
    return this.makeRequest("/roblox/set-rank", {
      user_id: userId,
      workspace_id: this.workspaceId,
      rank: 1,
    });
  }

  async setUserRank(
    userId: number,
    _groupId: string,
    rank: number
  ): Promise<RankGunResponse> {
    return this.makeRequest("/roblox/set-rank", {
      user_id: userId,
      workspace_id: this.workspaceId,
      rank: rank,
    });
  }
}

export async function getRankGun(
  workspaceGroupId: number
): Promise<RankGun | null> {
  try {
    const { default: prisma } = await import("@/utils/database");

    const settings = await prisma.workspaceExternalServices.findFirst({
      where: {
        workspaceGroupId,
        rankingProvider: "rankgun",
      },
    });

    if (!settings?.rankingToken || !settings?.rankingWorkspaceId) {
      return null;
    }

    return {
      apiKey: settings.rankingToken,
      workspaceId: String(settings.rankingWorkspaceId),
    };
  } catch (error) {
    return null;
  }
}

export interface RankingProvider {
  type: "rankgun" | "roblox_cloud";
  promoteUser(userId: number): Promise<RankGunResponse>;
  demoteUser(userId: number): Promise<RankGunResponse>;
  terminateUser(userId: number): Promise<RankGunResponse>;
  setUserRank(userId: number, rankOrRoleId: number): Promise<RankGunResponse>;
}

class RankGunProvider implements RankingProvider {
  type = "rankgun" as const;
  private api: RankGunAPI;
  private workspaceId: string;

  constructor(config: RankGun) {
    this.api = new RankGunAPI(config);
    this.workspaceId = config.workspaceId;
  }

  async promoteUser(userId: number) {
    return this.api.promoteUser(userId, this.workspaceId);
  }
  async demoteUser(userId: number) {
    return this.api.demoteUser(userId, this.workspaceId);
  }
  async terminateUser(userId: number) {
    return this.api.terminateUser(userId, this.workspaceId);
  }
  async setUserRank(userId: number, rank: number) {
    return this.api.setUserRank(userId, this.workspaceId, rank);
  }
}

class RobloxCloudProvider implements RankingProvider {
  type = "roblox_cloud" as const;
  private api: any;

  constructor(api: any) {
    this.api = api;
  }

  async promoteUser(userId: number) {
    return this.api.promoteUser(userId);
  }
  async demoteUser(userId: number) {
    return this.api.demoteUser(userId);
  }
  async terminateUser(userId: number) {
    return this.api.terminateUser(userId);
  }
  async setUserRank(userId: number, roleId: number) {
    return this.api.setUserRank(userId, roleId);
  }
}

export async function getRankingProvider(
  workspaceGroupId: number
): Promise<RankingProvider | null> {
  try {
    const { default: prisma } = await import("@/utils/database");

    const settings = await prisma.workspaceExternalServices.findFirst({
      where: { workspaceGroupId },
    });

    if (!settings?.rankingProvider) return null;

    if (settings.rankingProvider === "rankgun") {
      if (!settings.rankingToken || !settings.rankingWorkspaceId) return null;
      return new RankGunProvider({
        apiKey: settings.rankingToken,
        workspaceId: String(settings.rankingWorkspaceId),
      });
    }

    if (settings.rankingProvider === "roblox_cloud") {
      if (!settings.robloxApiKey) return null;
      const { RobloxCloudRankingAPI } = await import("@/utils/openCloud");
      const api = new RobloxCloudRankingAPI(settings.robloxApiKey, workspaceGroupId);
      return new RobloxCloudProvider(api);
    }

    return null;
  } catch (error) {
    return null;
  }
}
