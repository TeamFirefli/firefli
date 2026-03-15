import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { sendSessionNotification, editSessionNotification, getSessionStatus } from "@/utils/session-notification";

type Resp = {
  success: boolean;
  updatedStarted?: number;
  updatedEnded?: number;
  updatedStatus?: number;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const secret = req.headers["x-cron-secret"] || req.headers.authorization;
  const expected = process.env.CRON_SECRET;
  if (!expected) return res.status(500).json({ success: false, error: "CRON_SECRET not configured" });
  if (!secret || String(secret) !== expected) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const now = new Date();
    const lookahead = new Date(now.getTime() + 30 * 60 * 1000);
    const candidates = await prisma.session.findMany({
      where: {
        ended: null,
        date: {
          lte: lookahead,
        },
      },
      include: {
        sessionType: true,
      },
    });

    let updatedStarted = 0;
    let updatedEnded = 0;
    let updatedStatus = 0;

    for (const s of candidates) {
      const duration = s.duration;
      const endTime = new Date(new Date(s.date).getTime() + duration * 60 * 1000);

      if (endTime <= now) {
        await prisma.session.update({ where: { id: s.id }, data: { ended: endTime, lastDiscordStatus: 'Concluded' } });
        editSessionNotification(s.id, 'Concluded').catch(() => {});
        updatedEnded++;
      } else {
        if (!s.startedAt && s.date <= now) {
          await prisma.session.update({ where: { id: s.id }, data: { startedAt: s.date } });
          updatedStarted++;

          sendSessionNotification(s.sessionType.workspaceGroupId, 'start', {
            id: s.id,
            name: s.name || '',
            type: s.type || 'other',
            date: s.date,
            duration: (s as any).duration || 30,
            hostUserId: s.ownerId ? Number(s.ownerId) : null,
            sessionTypeName: s.sessionType.name,
          }).catch(() => {});
        }

        // Check for status transitions on active sessions
        if (s.discordMessageId) {
          const statues = (s.sessionType as any).statues || [];
          const currentStatus = getSessionStatus(s.date, duration, statues);
          if (currentStatus && currentStatus !== s.lastDiscordStatus) {
            editSessionNotification(s.id, currentStatus).catch(() => {});
            updatedStatus++;
          }
        }
      }
    }

    return res.status(200).json({ success: true, updatedStarted, updatedEnded, updatedStatus });
  } catch (e: any) {
    console.error("Cron update-sessions error:", e);
    return res.status(500).json({ success: false, error: String(e?.message || e) });
  }
}
