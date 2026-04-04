import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { checkGroupRoles } from "@/utils/permissionsManager";
import { getActiveBatch, logBatchSchedule } from "@/utils/batchScheduler";

type Resp = {
  success: boolean;
  started?: number;
  workspaces?: number[];
  error?: string;
  batchId?: number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>,
) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  const secret = req.headers["x-cron-secret"] || req.headers.authorization;
  const expected = process.env.CRON_SECRET;
  if (!expected)
    return res
      .status(500)
      .json({ success: false, error: "CRON_SECRET not configured" });
  if (!secret || String(secret) !== expected)
    return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const qid = req.query.id as string | undefined;
    const bodyId = (req.body && (req.body.workspaceId || req.body.id)) as
      | number
      | string
      | undefined;
    const requestedId = qid || bodyId;

    if (requestedId) {
      const workspaceId = parseInt(String(requestedId));
      if (isNaN(workspaceId))
        return res
          .status(400)
          .json({ success: false, error: "Invalid workspace ID" });
      checkGroupRoles(workspaceId).catch((e) =>
        console.error("checkgrouproles cron error:", e),
      );
      return res
        .status(200)
        .json({ success: true, started: 1, workspaces: [workspaceId] });
    }

    const isMultiContainer = process.env.NEXT_MULTI?.toLowerCase() === "true";
    const activeBatchId = getActiveBatch();

    if (isMultiContainer) {
      logBatchSchedule();
    }

    const whereClause =
      isMultiContainer && activeBatchId ? { batchId: activeBatchId } : {};

    const ws = await prisma.workspace.findMany({
      where: whereClause,
    });

    const ids: number[] = [];

    if (isMultiContainer) {
      console.log(
        `[cron-update-roles] Multi-container mode: Batch ${activeBatchId} - Starting sequential sync of ${ws.length} workspaces`,
      );
      let consecutiveConnectionFailures = 0;
      const MAX_CONSECUTIVE_CONNECTION_FAILURES = 2;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        ids.push(w.groupId);
        console.log(
          `[cron-update-roles] [Batch ${activeBatchId}] Syncing workspace ${i + 1}/${ws.length}: ${w.groupId}`,
        );

        try {
          await checkGroupRoles(w.groupId);
          consecutiveConnectionFailures = 0;
          console.log(
            `[cron-update-roles] [Batch ${activeBatchId}] Successfully synced workspace ${w.groupId}`,
          );
        } catch (e: any) {
          const isConnError =
            e?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
            e?.code === "ETIMEDOUT" ||
            e?.code === "ECONNREFUSED";
          if (isConnError) {
            consecutiveConnectionFailures++;
            console.warn(
              `[cron-update-roles] [Batch ${activeBatchId}] Connection failure for ${w.groupId} (${consecutiveConnectionFailures}/${MAX_CONSECUTIVE_CONNECTION_FAILURES} consecutive)`,
            );
            if (consecutiveConnectionFailures >= MAX_CONSECUTIVE_CONNECTION_FAILURES) {
              console.error(
                `[cron-update-roles] [Batch ${activeBatchId}] Circuit breaker triggered — Roblox API appears to be blocking this IP. Aborting remaining ${ws.length - i - 1} workspace(s) to allow IP cooldown.`,
              );
              break;
            }
          } else {
            console.error("checkgrouproles cron error for", w.groupId, e);
          }
        }

        if (i < ws.length - 1) {
          const delayMs = 15000;
          console.log(
            `[cron-update-roles] [Batch ${activeBatchId}] Waiting ${delayMs}ms before next workspace...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      console.log(
        `[cron-update-roles] [Batch ${activeBatchId}] Completed all ${ws.length} workspace syncs`,
      );
    } else {
      console.log(
        `[cron-update-roles] Single-container mode: Starting sequential sync of ${ws.length} workspaces`,
      );
      let consecutiveConnectionFailures = 0;
      const MAX_CONSECUTIVE_CONNECTION_FAILURES = 2;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        ids.push(w.groupId);
        console.log(
          `[cron-update-roles] Syncing workspace ${i + 1}/${ws.length}: ${w.groupId}`,
        );
        try {
          await checkGroupRoles(w.groupId);
          consecutiveConnectionFailures = 0;
          console.log(
            `[cron-update-roles] Successfully synced workspace ${w.groupId}`,
          );
        } catch (e: any) {
          const isConnError =
            e?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
            e?.code === "ETIMEDOUT" ||
            e?.code === "ECONNREFUSED";
          if (isConnError) {
            consecutiveConnectionFailures++;
            console.warn(
              `[cron-update-roles] Connection failure for ${w.groupId} (${consecutiveConnectionFailures}/${MAX_CONSECUTIVE_CONNECTION_FAILURES} consecutive)`,
            );
            if (consecutiveConnectionFailures >= MAX_CONSECUTIVE_CONNECTION_FAILURES) {
              console.error(
                `[cron-update-roles] Circuit breaker triggered — Roblox API appears to be blocking this IP. Aborting remaining ${ws.length - i - 1} workspace(s) to allow IP cooldown.`,
              );
              break;
            }
          } else {
            console.error("checkgrouproles cron error for", w.groupId, e);
          }
        }
        if (i < ws.length - 1) {
          const delayMs = 15000;
          console.log(
            `[cron-update-roles] Waiting ${delayMs}ms before next workspace...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return res.status(200).json({
      success: true,
      started: ids.length,
      workspaces: ids,
      batchId: activeBatchId,
    });
  } catch (e: any) {
    console.error("Cron checkgrouproles error:", e);
    return res
      .status(500)
      .json({ success: false, error: String(e?.message || e) });
  }
}
