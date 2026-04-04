import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";

type Resp = {
  success: boolean;
  totalUsers?: number;
  updated?: number;
  failed?: number;
  error?: string;
};

type RobloxUserData = {
  id: number;
  name: string;
  displayName: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const secret = req.headers["x-cron-secret"] || req.headers.authorization;
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return res.status(500).json({ success: false, error: "CRON_SECRET not configured" });
  }

  if (!secret || String(secret) !== expected) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const isMultiContainer = process.env.NEXT_MULTI?.toLowerCase() === "true";
  console.log(`[User Sync] Starting user info update${isMultiContainer ? " (multi-container mode)" : ""}`);

  try {
    const allUsers = await prisma.user.findMany({
      select: {
        userid: true,
        username: true,
        displayName: true,
      },
    });

    console.log(`[User Sync] Found ${allUsers.length} users to update`);

    let updated = 0;
    let failed = 0;
    const BATCH_SIZE = isMultiContainer ? 10 : 50;
    const BATCH_DELAY_MS = isMultiContainer ? 5000 : 1000;
    const batches: bigint[][] = [];

    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE).map((u) => u.userid);
      batches.push(batch);
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const userIds = batch.map((id) => Number(id));

      try {
        const response = await fetch("https://users.roblox.com/v1/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userIds: userIds,
            excludeBannedUsers: false,
          }),
        });

        if (!response.ok) {
          failed += batch.length;
          continue;
        }

        const data = await response.json();
        const userData: RobloxUserData[] = data.data || [];

        for (const user of userData) {
          try {
            await prisma.user.update({
              where: { userid: BigInt(user.id) },
              data: {
                username: user.name,
                displayName: user.displayName,
              },
            });
            updated++;
          } catch (updateError) {
            console.error(
              `[User Sync] Failed to update user ${user.id}:`,
              updateError
            );
            failed++;
          }
        }

        const returnedIds = new Set(userData.map((u) => u.id));
        const missingIds = userIds.filter((id) => !returnedIds.has(id));

        if (missingIds.length > 0) {
          failed += missingIds.length;
        }

        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      } catch (batchError) {
        failed += batch.length;
      }
    }

    return res.status(200).json({
      success: true,
      totalUsers: allUsers.length,
      updated,
      failed,
    });
  } catch (error: any) {
    console.error("[User Sync] Fatal error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
}
