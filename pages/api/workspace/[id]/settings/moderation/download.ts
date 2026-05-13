import type { NextApiRequest, NextApiResponse } from "next";
import { withPermissionCheck } from "@/utils/permissionsManager";
import * as fs from "fs";
import * as path from "path";

type Data = {
  success: boolean;
  error?: string;
};

export default withPermissionCheck(handler, "admin");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  const filePath = path.join(process.cwd(), "Firefli-moderation.rbxm");
  const fileBuffer = fs.readFileSync(filePath);

  res.setHeader("Content-Disposition", "attachment; filename=Firefli-moderation.rbxm");
  res.setHeader("Content-Type", "application/octet-stream");
  res.status(200).send(fileBuffer as any);
}
