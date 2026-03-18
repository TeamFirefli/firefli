import type { NextApiRequest, NextApiResponse } from "next";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { getConfig, setConfig } from "@/utils/configEngine";
import prisma from "@/utils/database";

type Data = {
  success: boolean;
  order?: string[];
  error?: string;
};

const handler = async (req: NextApiRequest, res: NextApiResponse<Data>) => {
  const { id } = req.query;
  const workspaceGroupId = parseInt(id as string);

  if (!workspaceGroupId) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid workspace ID" });
  }

  if (req.method === "GET") {
    const directoryConfig = (await getConfig(
      "directory",
      workspaceGroupId,
    )) as { departmentOrder?: string[] } | null;
    return res.status(200).json({
      success: true,
      order: Array.isArray(directoryConfig?.departmentOrder)
        ? directoryConfig!.departmentOrder
        : [],
    });
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const incomingOrder = req.body?.order;
  if (!Array.isArray(incomingOrder)) {
    return res
      .status(400)
      .json({ success: false, error: "Order must be an array" });
  }

  const validDepartments = await prisma.department.findMany({
    where: { workspaceGroupId },
    select: { id: true },
  });
  const validIds = new Set(validDepartments.map((d) => d.id));

  const filteredOrder: string[] = [];
  const seen = new Set<string>();
  for (const rawId of incomingOrder) {
    if (typeof rawId !== "string") continue;
    if (!validIds.has(rawId)) continue;
    if (seen.has(rawId)) continue;
    seen.add(rawId);
    filteredOrder.push(rawId);
  }

  for (const dept of validDepartments) {
    if (!seen.has(dept.id)) {
      filteredOrder.push(dept.id);
    }
  }

  const existingDirectoryConfig =
    ((await getConfig("directory", workspaceGroupId)) as Record<
      string,
      any
    > | null) || {};

  await setConfig(
    "directory",
    {
      ...existingDirectoryConfig,
      departmentOrder: filteredOrder,
    },
    workspaceGroupId,
  );

  return res.status(200).json({ success: true, order: filteredOrder });
};

export default withPermissionCheck(handler, "admin");