import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { fetchOpenCloudGroupMembers } from "@/utils/openCloud";

export default withPermissionCheck(handler, "admin");

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: workspaceId } = req.query;

  if (!workspaceId || typeof workspaceId !== "string") {
    return res.status(400).json({ message: "Invalid workspace ID" });
  }

  if (req.method === "GET") {
    try {
      const settings = await prisma.workspaceExternalServices.findFirst({
        where: {
          workspaceGroupId: parseInt(workspaceId),
        },
      });

      const hasKey = !!settings?.robloxApiKey;
      let robloxApiKeyValid: boolean | null = null;

      // If ?validate=true, actually test the stored key
      if (req.query.validate === "true" && hasKey && settings?.robloxApiKey) {
        try {
          await fetchOpenCloudGroupMembers(parseInt(workspaceId), settings.robloxApiKey, 1);
          robloxApiKeyValid = true;
        } catch {
          robloxApiKeyValid = false;
        }
      }

      return res.status(200).json({
        rankingProvider: settings?.rankingProvider || "",
        rankingToken: settings?.rankingToken || "",
        rankingWorkspaceId: settings?.rankingWorkspaceId || "",
        robloxApiKey: settings?.robloxApiKey ? "••••••••" + settings.robloxApiKey.slice(-8) : "",
        ...(robloxApiKeyValid !== null && { robloxApiKeyValid }),
      });
    } catch (error) {
      console.error("Error fetching external services settings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    const { rankingProvider, rankingToken, rankingWorkspaceId, robloxApiKey } = req.body;

    if (typeof rankingProvider !== "string") {
      return res.status(400).json({ message: "Invalid ranking provider" });
    }
    if (rankingProvider === "rankgun") {
      if (!rankingToken || !rankingWorkspaceId) {
        return res
          .status(400)
          .json({ message: "RankGun requires both API key and workspace ID" });
      }
    }
    if (rankingProvider === "roblox_cloud") {
      const hasNewKey = robloxApiKey && !robloxApiKey.startsWith("••••");
      if (!hasNewKey) {
        const existing = await prisma.workspaceExternalServices.findUnique({
          where: { workspaceGroupId: parseInt(workspaceId) },
          select: { robloxApiKey: true },
        });
        if (!existing?.robloxApiKey) {
          return res.status(400).json({
            message: "Roblox Open Cloud ranking requires an API key. Configure one in the section below first.",
          });
        }
      }
    }

    const shouldUpdateRobloxKey = robloxApiKey !== undefined && robloxApiKey !== null && !robloxApiKey.startsWith("••••");

    try {
      const updateData: any = {
        rankingProvider: rankingProvider || null,
        rankingToken: rankingToken || null,
        rankingWorkspaceId: rankingWorkspaceId || null,
        updatedAt: new Date(),
      };
      const createData: any = {
        workspaceGroupId: parseInt(workspaceId),
        rankingProvider: rankingProvider || null,
        rankingToken: rankingToken || null,
        rankingWorkspaceId: rankingWorkspaceId || null,
      };

      if (shouldUpdateRobloxKey) {
        updateData.robloxApiKey = robloxApiKey || null;
        createData.robloxApiKey = robloxApiKey || null;
      }

      await prisma.workspaceExternalServices.upsert({
        where: {
          workspaceGroupId: parseInt(workspaceId),
        },
        update: updateData,
        create: createData,
      });

      return res.status(200).json({ message: "Settings saved successfully" });
    } catch (error) {
      console.error("Error saving external services settings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
