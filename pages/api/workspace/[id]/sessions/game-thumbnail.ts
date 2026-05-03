import type { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "@/lib/withSession";
import axios from "axios";

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

  try {
    let universeId: number | null = null;
    const directThumbRes = await axios.get(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${placeId}&size=768x432&format=Png&isCircular=false`,
      { timeout: 5000 }
    );
    const directUrl = directThumbRes.data?.data?.[0]?.thumbnails?.[0]?.imageUrl;
    if (directUrl) {
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
      return res.status(200).json({ success: true, thumbnailUrl: directUrl });
    }

    const placeDetailsRes = await axios.get(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,
      { timeout: 5000 }
    );
    universeId = placeDetailsRes.data?.[0]?.universeId ?? null;
    if (!universeId)
      return res.status(404).json({ success: false, error: "Universe not found" });

    const thumbRes = await axios.get(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
      { timeout: 5000 }
    );
    const thumbnailUrl = thumbRes.data?.data?.[0]?.thumbnails?.[0]?.imageUrl;
    if (!thumbnailUrl)
      return res.status(404).json({ success: false, error: "Thumbnail not found" });

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    return res.status(200).json({ success: true, thumbnailUrl });
  } catch {
    return res.status(502).json({ success: false, error: "Failed to fetch thumbnail" });
  }
}
