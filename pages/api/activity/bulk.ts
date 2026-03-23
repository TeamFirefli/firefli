// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";
import * as noblox from "noblox.js";
import { getUsername, getThumbnail } from "@/utils/userinfoEngine";
import { checkSpecificUser } from "@/utils/permissionsManager";
import { generateSessionTimeMessage } from "@/utils/sessionMessage";
import { sendSessionReviewNotification } from "@/utils/session-review-notification";

type Data = {
  success: boolean;
  error?: string;
  results?: {
    created: number;
    ended: number;
    failed: number;
    errors: string[];
  };
};

type BulkEvent = {
  type: "create" | "end";
  userid: number;
  placeid?: number;
  idleTime?: number;
  messages?: number;
};

export default withSessionRoute(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const { authorization } = req.headers;
  const { events } = req.body;

  if (!authorization)
    return res
      .status(400)
      .json({ success: false, error: "Authorization key missing" });

  if (!events || !Array.isArray(events) || events.length === 0)
    return res
      .status(400)
      .json({ success: false, error: "Events array is required and must not be empty" });

  try {
    const config = await prisma.config.findFirst({
      where: {
        value: {
          path: ["key"],
          equals: authorization,
        },
      },
    });

    if (!config) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const groupId = config.workspaceGroupId;
    const parsedConfig = JSON.parse(JSON.stringify(config.value));

    let created = 0;
    let ended = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const event of events as BulkEvent[]) {
      try {
        const { type, userid, placeid, idleTime, messages } = event;

        if (!userid || isNaN(userid)) {
          failed++;
          errors.push(`Invalid userid: ${userid}`);
          continue;
        }

        const userRank = await noblox
          .getRankInGroup(groupId, userid)
          .catch(() => null);
        await checkSpecificUser(userid);

        if (parsedConfig.role && (!userRank || userRank <= parsedConfig.role)) {
          continue;
        }

        const username = await getUsername(userid);
        const picture = getThumbnail(userid);
        await prisma.user.upsert({
          where: { userid: BigInt(userid) },
          update: { username, picture },
          create: { userid: BigInt(userid), username, picture },
        });

        if (type === "create") {
          const existing = await prisma.activitySession.findFirst({
            where: {
              userId: BigInt(userid),
              active: true,
              workspaceGroupId: groupId,
            },
          });

          if (existing) {
            continue;
          }

          let gameName = null;
          if (placeid) {
            try {
              const universeInfo: any = await noblox.getUniverseInfo(Number(placeid));
              if (universeInfo?.[0]?.name) {
                gameName = universeInfo[0].name;
              };
            } catch {
              // ignore
            };
          };

          const sessionStartTime = new Date();
          const sessionMessage = generateSessionTimeMessage(gameName, sessionStartTime);

          await prisma.activitySession.create({
            data: {
              id: crypto.randomUUID(),
              userId: BigInt(userid),
              active: true,
              startTime: sessionStartTime,
              universeId: placeid ? BigInt(placeid) : null,
              sessionMessage,
              workspaceGroupId: groupId,
            },
          });

          console.log(`[SESSION CREATED] User ${userid} for group ${groupId} - ${sessionMessage}`);
          created++;
        } else if (type === "end") {
          const session = await prisma.activitySession.findFirst({
            where: {
              userId: BigInt(userid),
              active: true,
              workspaceGroupId: groupId,
            },
          });

          if (!session) {
            const recentSession = await prisma.activitySession.findFirst({
              where: {
                userId: BigInt(userid),
                active: false,
                workspaceGroupId: groupId,
                endTime: { gte: new Date(Date.now() - 60_000) },
              },
              orderBy: { endTime: "desc" },
            });

            if (recentSession) {
              const sessionIdleTime = idleTime ? Number(idleTime) : Number(recentSession.idleTime ?? 0);
              const sessionMessages = messages ? Number(messages) : Number(recentSession.messages ?? 0);

              if (idleTime || messages) {
                await prisma.activitySession.update({
                  where: { id: recentSession.id },
                  data: { idleTime: sessionIdleTime, messages: sessionMessages },
                });
              }

              sendSessionReviewNotification({
                sessionId: recentSession.id,
                userId: BigInt(userid),
                startTime: recentSession.startTime,
                endTime: recentSession.endTime!,
                idleTime: sessionIdleTime,
                messages: sessionMessages,
                sessionMessage: recentSession.sessionMessage,
                workspaceGroupId: groupId,
              }).catch((err) => console.error("[SessionReview] Error:", err));

              ended++;
              continue;
            }

            failed++;
            errors.push(`No active session for user ${userid}`);
            continue;
          }

          const sessionEndTime = new Date();
          const sessionIdleTime = idleTime ? Number(idleTime) : 0;
          const sessionMessages = messages ? Number(messages) : 0;

          await prisma.activitySession.update({
            where: { id: session.id },
            data: {
              endTime: sessionEndTime,
              active: false,
              idleTime: sessionIdleTime,
              messages: sessionMessages,
            },
          });

          sendSessionReviewNotification({
            sessionId: session.id,
            userId: BigInt(userid),
            startTime: session.startTime,
            endTime: sessionEndTime,
            idleTime: sessionIdleTime,
            messages: sessionMessages,
            sessionMessage: session.sessionMessage,
            workspaceGroupId: groupId,
          }).catch((err) => console.error("[SessionReview] Error:", err));

          console.log(`[SESSION ENDED] User ${userid} (ID: ${session.id})`);
          ended++;
        } else {
          failed++;
          errors.push(`Invalid event type: ${type}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`Error processing event for user ${event.userid}: ${error.message}`);
        console.error(`[BULK] Error processing event:`, error);
      }
    }

    console.log(`[BULK] Processed ${created} creates, ${ended} ends, ${failed} failed for group ${groupId}`);

    return res.status(200).json({
      success: true,
      results: { created, ended, failed, errors },
    });
  } catch (error: any) {
    console.error("Unexpected error in /api/activity/bulk:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}
