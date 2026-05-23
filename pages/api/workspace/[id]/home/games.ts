import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig } from '@/utils/configEngine';
import { withSessionRoute } from '@/lib/withSession';
import { fetchApi, isAnyErrorResponse } from 'rozod';
import { getGames } from 'rozod/endpoints/gamesv1';
import prisma from '@/utils/database';
import axios from 'axios';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const noThrow = { timeout: 8000, validateStatus: () => true } as const;
async function resolveGame(placeId: number): Promise<{ universeId: number | null; imageUrl: string | null }> {
  const cached = await (prisma as any).thumbnails.findUnique({
    where: { placeId: BigInt(placeId) },
  }).catch(() => null);

  const isStale = !cached || Date.now() - new Date(cached.updatedAt).getTime() > CACHE_TTL_MS;

  if (cached && !isStale && cached.universeId && cached.imageUrl) {
    return { universeId: Number(cached.universeId), imageUrl: cached.imageUrl };
  }

  let universeId: number | null = cached?.universeId ? Number(cached.universeId) : null;
  if (!universeId) {
    const r = await axios.get(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
      noThrow
    );
    universeId = r.data?.universeId ?? null;
  }

  let imageUrl: string | null = cached?.imageUrl ?? null;
  if (universeId) {
    const r = await axios.get(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
      noThrow
    );
    const entry = r.data?.data?.[0];
    const url: string | undefined = entry?.thumbnails?.[0]?.imageUrl;
    if (url && entry?.thumbnails?.[0]?.state === 'Completed') imageUrl = url;
  }

  if (universeId || imageUrl) {
    (prisma as any).thumbnails.upsert({
      where: { placeId: BigInt(placeId) },
      update: { universeId: universeId ? BigInt(universeId) : null, imageUrl: imageUrl ?? '', updatedAt: new Date() },
      create: { placeId: BigInt(placeId), universeId: universeId ? BigInt(universeId) : null, imageUrl: imageUrl ?? '' },
    }).catch(() => {});
  }

  return { universeId, imageUrl };
}

export default withSessionRoute(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  if (!req.session.userid) return res.status(401).json({ success: false, error: 'Not logged in' });

  const workspaceId = parseInt(req.query.id as string, 10);
  if (!workspaceId) return res.status(400).json({ success: false, error: 'Invalid workspace id' });

  try {
    const gamesConfig = await getConfig('games', workspaceId);
    const placeIds: number[] = Array.isArray(gamesConfig?.placeIds)
      ? gamesConfig.placeIds.filter((id: any) => Number.isFinite(Number(id))).map(Number)
      : [];

    if (placeIds.length === 0) return res.status(200).json({ success: true, games: [] });
    const resolved = await Promise.all(placeIds.map(resolveGame));
    const universeIds = resolved
      .map((r) => r.universeId)
      .filter((uid): uid is number => !!uid);

    let gamesData: any[] = [];
    if (universeIds.length > 0) {
      const gamesResult = await fetchApi(getGames, { universeIds });
      gamesData = isAnyErrorResponse(gamesResult) ? [] : (gamesResult.data ?? []);
    }

    let placeDetailsMap: Record<number, string> = {};
    if (placeIds.length > 0) {
      const r = await axios.get(
        `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeIds.join(',')}`,
        noThrow,
      );
      if (Array.isArray(r.data)) {
        for (const detail of r.data) {
          if (detail?.placeId && detail?.name) {
            placeDetailsMap[Number(detail.placeId)] = detail.name;
          }
        }
      }
    }

    const games = placeIds.map((pid, i) => {
      const uid = resolved[i].universeId;
      const info = uid ? gamesData.find((g: any) => g.id === uid) : undefined;
      return {
        placeId: pid,
        name: placeDetailsMap[pid] ?? info?.name ?? 'Unknown Game',
        playing: info?.playing ?? 0,
        visits: info?.visits ?? 0,
        thumbnail: resolved[i].imageUrl,
      };
    });

    return res.status(200).json({ success: true, games });
  } catch (e) {
    console.error('Error fetching games:', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
