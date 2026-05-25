import { getRankingProvider } from "@/utils/rankgun";

export interface RankActionResult {
  attempted: boolean;
  success: boolean;
  rankId?: number | string;
  provider?: string;
  error?: string;
}

export async function rankUser(
  workspaceGroupId: bigint | number,
  userId: number | bigint,
  rankOrRoleId: number | bigint
): Promise<RankActionResult> {
  try {
    const provider = await getRankingProvider(workspaceGroupId);
    if (!provider) {
      return { attempted: false, success: false, error: "No ranking provider configured" };
    }
    const res = await provider.setUserRank(Number(userId), Number(rankOrRoleId));
    return {
      attempted: true,
      success: !!res.success,
      rankId: Number(rankOrRoleId),
      provider: provider.type,
      error: res.success ? undefined : res.error || "Unknown ranking failure",
    };
  } catch (err: any) {
    return {
      attempted: true,
      success: false,
      rankId: Number(rankOrRoleId),
      error: err?.message || String(err),
    };
  }
}
