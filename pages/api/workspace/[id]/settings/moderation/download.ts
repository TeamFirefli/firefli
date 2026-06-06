import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, setConfig } from "@/utils/configEngine";
import { withPermissionCheck } from "@/utils/permissionsManager";
import * as crypto from "crypto";
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

  let moderationconfig = await getConfig(
    "moderation",
    parseInt(req.query.id as string)
  );
  if (!moderationconfig?.key) {
    moderationconfig = {
      key: crypto.randomBytes(16).toString("hex"),
    };
    setConfig("moderation", moderationconfig, parseInt(req.query.id as string));
  }

  let xml_string = fs.readFileSync(path.join("Firefli-moderation.rbxmx"), "utf8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=Firefli-moderation.rbxmx"
  );

  let protocol =
    req.headers["x-forwarded-proto"] ||
    req.headers.referer?.split("://")[0] ||
    "http";

  if (typeof protocol === "string") {
    protocol = protocol.split(",")[0];
  } else if (Array.isArray(protocol)) {
    protocol = protocol[0].split(",")[0];
  }

  const host = req.headers.host;

  let currentUrl = new URL(`${protocol}://${host}`);
  let xx = xml_string
    .replace("<apikey>", moderationconfig.key)
    .replace("<url>", currentUrl.origin);

  res.setHeader("Content-Type", "application/rbxmx");
  res.status(200).send(xx as any);
}
