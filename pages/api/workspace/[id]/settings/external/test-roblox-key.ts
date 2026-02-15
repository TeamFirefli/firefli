import type { NextApiRequest, NextApiResponse } from "next";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { fetchOpenCloudGroupMembers } from "@/utils/openCloud";

export default withPermissionCheck(handler, "admin");

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { id: workspaceId } = req.query;
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(400).json({ valid: false, message: "API key is required" });
  }

  if (!workspaceId || typeof workspaceId !== "string") {
    return res.status(400).json({ valid: false, message: "Invalid workspace ID" });
  }

  const groupId = parseInt(workspaceId);

  try {
    const result = await fetchOpenCloudGroupMembers(groupId, apiKey, 1);
    return res.status(200).json({
      valid: true,
      memberCount: result.members.length,
      message: `Successfully connected! Found members in the group.`,
    });
  } catch (error: any) {
    console.error("[test-roblox-key] Validation failed:", error.message);
    
    let message = "API key is invalid or lacks the required permissions.";
    if (error.message?.includes("403")) {
      message = "API key lacks permission to read this group's members. Make sure the Group API system is added with Read access for your group.";
    } else if (error.message?.includes("401") || error.message?.includes("Invalid API Key")) {
      message = "Invalid API key. Please check the key and try again.";
    } else if (error.message?.includes("IP")) {
      message = "Your server's IP is not in the API key's allowed IPs.";
    }

    return res.status(200).json({ valid: false, message });
  }
}
