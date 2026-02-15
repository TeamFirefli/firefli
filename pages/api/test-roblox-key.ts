import type { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "@/lib/withSession";
import { fetchOpenCloudGroupMembers } from "@/utils/openCloud";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, message: "Method not allowed" });
  }

  if (!req.session?.userid) {
    return res.status(401).json({ valid: false, message: "Not logged in" });
  }

  const { apiKey, groupId } = req.body;

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(400).json({ valid: false, message: "API key is required" });
  }

  if (!groupId || isNaN(Number(groupId))) {
    return res.status(400).json({ valid: false, message: "Valid group ID is required" });
  }

  const parsedGroupId = Number(groupId);

  try {
    const result = await fetchOpenCloudGroupMembers(parsedGroupId, apiKey, 1);
    return res.status(200).json({
      valid: true,
      memberCount: result.members.length,
      message: "Successfully connected! API key is valid for this group.",
    });
  } catch (error: any) {
    console.error("[test-roblox-key] Validation failed:", error.message);

    let message = "API key is invalid or lacks the required permissions.";
    if (error.message?.includes("403")) {
      message =
        "API key lacks permission to read this group's members. Make sure the Group API system is added with Read access for your group.";
    } else if (
      error.message?.includes("401") ||
      error.message?.includes("Invalid API Key")
    ) {
      message = "Invalid API key. Please check the key and try again.";
    } else if (error.message?.includes("IP")) {
      message = "Your server's IP is not in the API key's allowed IPs.";
    }

    return res.status(200).json({ valid: false, message });
  }
}

export default withSessionRoute(handler);
