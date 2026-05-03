import type { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "@/lib/withSession";
import axios from "axios";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "public", "places");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type Data = {
  success: boolean;
  thumbnailUrl?: string;
  error?: string;
};

export default withSessionRoute(handler);

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, error: "Method not allowed" });
  if (!req.session.userid)
    return res.status(401).json({ success: false, error: "Not logged in" });

  const placeId = req.query.placeId as string;
  if (!placeId || !/^\d+$/.test(placeId))
    return res.status(400).json({ success: false, error: "Invalid placeId" });

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  const cacheFile = path.join(CACHE_DIR, `${placeId}.png`);
  const publicUrl = `/places/${placeId}.png`;
  if (fs.existsSync(cacheFile)) {
    const { mtimeMs } = fs.statSync(cacheFile);
    if (Date.now() - mtimeMs < CACHE_TTL_MS) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(200).json({ success: true, thumbnailUrl: publicUrl });
    }
  }

  const noThrow = { timeout: 8000, validateStatus: () => true };

  const getThumbnailByUniverseId = async (universeId: string | number) => {
    const r = await axios.get(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
      noThrow
    );
    const entry = r.data?.data?.[0];
    const url: string | undefined = entry?.thumbnails?.[0]?.imageUrl;
    return url && entry?.thumbnails?.[0]?.state === "Completed" ? url : undefined;
  };

  try {
    let robloxUrl: string | undefined;
    robloxUrl = await getThumbnailByUniverseId(placeId);
    if (!robloxUrl) {
      const universeRes = await axios.get(
        `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
        noThrow
      );
      const universeId: number | undefined = universeRes.data?.universeId;
      if (universeId) robloxUrl = await getThumbnailByUniverseId(universeId);
    }

    if (!robloxUrl) {
      if (fs.existsSync(cacheFile)) {
        return res.status(200).json({ success: true, thumbnailUrl: publicUrl });
      }
      return res.status(404).json({ success: false, error: "Thumbnail not found" });
    }

    const imgRes = await axios.get<ArrayBuffer>(robloxUrl, {
      responseType: "arraybuffer",
      timeout: 8000,
    });
    fs.writeFileSync(cacheFile, Buffer.from(imgRes.data));

    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).json({ success: true, thumbnailUrl: publicUrl });
  } catch {
    if (fs.existsSync(cacheFile)) {
      return res.status(200).json({ success: true, thumbnailUrl: publicUrl });
    }
    return res.status(502).json({ success: false, error: "Failed to fetch thumbnail" });
  }
}
