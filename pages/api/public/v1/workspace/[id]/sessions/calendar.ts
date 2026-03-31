import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { validateApiKey } from "@/utils/api-auth";
import { withPublicApiRateLimit } from "@/utils/prtl"
import { getSessionStatus } from "@/utils/session-notification"

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey)
    return res.status(401).json({ success: false, error: "Missing API key" });

  const workspaceId = Number.parseInt(req.query.id as string);
  if (!workspaceId)
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });

  const { startDate, endDate, category } = req.query;

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ success: false, error: "Start date and end date are required" });
  }

  try {
    const key = await validateApiKey(apiKey, workspaceId.toString());
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const where: any = {
      sessionType: {
        workspaceGroupId: workspaceId,
      },
      date: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      },
    };

    if (category) {
      where.type = category as string;
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        owner: {
          select: {
            userid: true,
            username: true,
            picture: true,
          },
        },
        sessionType: {
          select: {
            id: true,
            name: true,
            description: true,
            gameId: true,
            slots: true,
            statues: true,
          },
        },
        sessionTag: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                userid: true,
                username: true,
                picture: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    const formattedSessions = sessions.map((session) => {
      const sessionSlots = (session.sessionType.slots as any[]) || [];
      const participants = session.users.map((user) => {
        const matchingSlot = sessionSlots.find((s: any) => s.id === user.roleID);
        return {
          userId: Number(user.user.userid),
          username: user.user.username,
          thumbnail: user.user.picture,
          slot: user.slot,
          role: user.roleID,
          roleName: matchingSlot?.name || null,
          hostRole: matchingSlot?.hostRole || null,
          categoryId: matchingSlot?.categoryId || null,
          categoryName: matchingSlot?.categoryName || null,
        };
      });
      const primaryHostParticipant = participants.find(
        (p) => p.hostRole === "primary" && p.slot === 0
      ) || participants.find((p) => p.hostRole === "primary") || null;

      return {
        id: session.id,
        name: session.name,
        date: session.date,
        startedAt: session.startedAt,
        ended: session.ended,
        type: {
          id: session.sessionType.id,
          description: session.sessionType.description,
          category: session.type,
          gameId: session.sessionType.gameId
            ? Number(session.sessionType.gameId)
            : null,
          slots: sessionSlots.map((s: any) => ({
            id: s.id,
            name: s.name,
            slots: s.slots,
            hostRole: s.hostRole || null,
            categoryId: s.categoryId || null,
            categoryName: s.categoryName || null,
          })),
        },
        tag: session.sessionTag
          ? {
              id: session.sessionTag.id,
              name: session.sessionTag.name,
              color: session.sessionTag.color,
            }
          : null,
        host: session.owner
          ? {
              userId: Number(session.owner.userid),
              username: session.owner.username,
              thumbnail: session.owner.picture,
            }
          : null,
        primaryHost: primaryHostParticipant
          ? {
              userId: primaryHostParticipant.userId,
              username: primaryHostParticipant.username,
              thumbnail: primaryHostParticipant.thumbnail,
            }
          : null,
        participants,
        status: (() => {
          const statues = (session.sessionType as any).statues || [];
          const computedStatus = getSessionStatus(session.date, session.duration, statues, session.ended);
          if (computedStatus) return computedStatus.toLowerCase().replace(/\s+/g, '-');
          if (session.ended) return 'ended';
          if (session.startedAt) return 'in-progress';
          return 'scheduled';
        })(),
      };
    });

    const sessionsByDate = formattedSessions.reduce(
      (acc: { [key: string]: any[] }, session) => {
        const dateKey = session.date.toISOString().split("T")[0]; // YYYY-MM-DD format
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(session);
        return acc;
      },
      {}
    );

    return res.status(200).json({
      success: true,
      sessions: formattedSessions,
      sessionsByDate,
      dateRange: {
        startDate: startDate as string,
        endDate: endDate as string,
      },
      total: formattedSessions.length,
    });
  } catch (error) {
    console.error("Error in public API:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export default withPublicApiRateLimit(handler)