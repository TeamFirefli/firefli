import { fetchApi, isAnyErrorResponse } from "rozod";
import { getUsersUserid, postUsernamesUsers } from "rozod/endpoints/usersv1";
import { getUsersAvatarHeadshot, getGroupsIcons } from "rozod/endpoints/thumbnailsv1";
import {
  getGroupsGroupid,
  getGroupsGroupidRoles,
  getUsersUseridGroupsRoles,
} from "rozod/endpoints/groupsv1";
import { getGames } from "rozod/endpoints/gamesv1";
import { getGroupsGroupidGames } from "rozod/endpoints/gamesv2";

export type RobloxRole = {
  id: number;
  name: string;
  rank: number;
  description: string;
  memberCount: number;
};

const TIMEOUT_MS = 12000;

async function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

export async function getRobloxUsername(id: number | bigint) {
  try {
    const result = await withTimeout(
      fetchApi(getUsersUserid, { userId: Number(id) }, { throwOnError: true })
    );
    return result.name;
  } catch (error) {
    console.error(`Error getting username for user ${id}:`, error);
    return "Unknown User";
  }
}

export async function getRobloxThumbnail(id: number | bigint) {
  try {
    const result = await withTimeout(
      fetchApi(getUsersAvatarHeadshot, { userIds: [Number(id)], size: "720x720", format: "Png" })
    );
    if (isAnyErrorResponse(result)) return "";
    return result.data?.[0]?.imageUrl ?? "";
  } catch (error) {
    console.error(`Error getting thumbnail for user ${id}:`, error);
    return "";
  }
}

export async function getPlayerThumbnails(userIds: number[], size: "180x180" | "720x720" = "180x180") {
  try {
    const result = await fetchApi(getUsersAvatarHeadshot, { userIds, size, format: "Png" });
    if (isAnyErrorResponse(result)) return [];
    return result.data ?? [];
  } catch (error) {
    console.error("Error getting player thumbnails:", error);
    return [];
  }
}

export async function getRobloxDisplayName(id: number | bigint) {
  try {
    const result = await withTimeout(
      fetchApi(getUsersUserid, { userId: Number(id) }, { throwOnError: true })
    );
    return result.displayName || "Unknown User";
  } catch (error) {
    console.error(`Error getting display name for user ${id}:`, error);
    try {
      return await getRobloxUsername(id);
    } catch {
      return "Unknown User";
    }
  }
}

export async function getRobloxUserId(username: string, origin?: string): Promise<number> {
  try {
    const result = await withTimeout(
      fetchApi(postUsernamesUsers, { body: { usernames: [username], excludeBannedUsers: false } }, { throwOnError: true })
    );
    const id = result.data?.[0]?.id;
    if (!id) throw new Error(`User not found: ${username}`);
    return id;
  } catch (error) {
    console.error(`Error getting user ID for username ${username}:`, error);
    throw error;
  }
}

export async function getRobloxBlurb(userId: number): Promise<string | null> {
  try {
    const result = await fetchApi(getUsersUserid, { userId }, { throwOnError: true });
    return result.description ?? null;
  } catch (error) {
    console.error(`Error getting blurb for user ${userId}:`, error);
    return null;
  }
}

export async function getGroupLogo(groupId: number): Promise<string> {
  try {
    const result = await fetchApi(getGroupsIcons, { groupIds: [groupId], size: "150x150", format: "Png" });
    if (isAnyErrorResponse(result)) return "";
    return result.data?.[0]?.imageUrl ?? "";
  } catch (error) {
    console.error(`Error getting logo for group ${groupId}:`, error);
    return "";
  }
}

export async function getGroupInfo(groupId: number) {
  return fetchApi(getGroupsGroupid, { groupId }, { throwOnError: true });
}

export async function getGroupRoles(groupId: number): Promise<RobloxRole[]> {
  try {
    const result = await fetchApi(getGroupsGroupidRoles, { groupId }, { throwOnError: true });
    return (result.roles ?? []) as RobloxRole[];
  } catch (error) {
    console.error(`Error getting roles for group ${groupId}:`, error);
    return [];
  }
}

export async function getGroupRole(groupId: number, rank: number | null): Promise<RobloxRole | null> {
  if (rank === null) return null;
  const roles = await getGroupRoles(groupId);
  return roles.find((r) => r.rank === rank) ?? null;
}

export async function getRankInGroup(groupId: number, userId: number): Promise<number | null> {
  try {
    const result = await fetchApi(getUsersUseridGroupsRoles, { userId });
    if (isAnyErrorResponse(result)) return null;
    const entry = result.data?.find((g: any) => g.group?.id === groupId);
    return entry?.role?.rank ?? null;
  } catch (error) {
    console.error(`Error getting rank for user ${userId} in group ${groupId}:`, error);
    return null;
  }
}

export async function fetchUniverseInfo(universeId: number) {
  try {
    const result = await fetchApi(getGames, { universeIds: [universeId] });
    if (isAnyErrorResponse(result)) return [];
    return result.data ?? [];
  } catch (error) {
    console.error(`Error getting universe info for ${universeId}:`, error);
    return [];
  }
}

export async function fetchGroupGames(groupId: number) {
  try {
    const groupResult = await fetchApi(getGroupsGroupidGames, { groupId, limit: 100 });
    if (isAnyErrorResponse(groupResult)) return [];
    const groupGames = groupResult.data ?? [];
    if (groupGames.length === 0) return [];
    const universeIds = groupGames.map((g: any) => g.id);
    const batchSize = 50;
    const detailed: any[] = [];
    for (let i = 0; i < universeIds.length; i += batchSize) {
      const batch = universeIds.slice(i, i + batchSize);
      const detailResult = await fetchApi(getGames, { universeIds: batch });
      if (!isAnyErrorResponse(detailResult)) {
        detailed.push(...(detailResult.data ?? []));
      }
    }
    return detailed;
  } catch (error) {
    console.error(`Error getting games for group ${groupId}:`, error);
    return [];
  }
}