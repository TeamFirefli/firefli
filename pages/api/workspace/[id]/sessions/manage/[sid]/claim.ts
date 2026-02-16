// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import prisma, { schedule } from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";
import { sendSessionNotification } from "@/utils/session-notification";
import roles from "../../../settings/roles";
type Data = {
  success: boolean;
  error?: string;
  session?: schedule;
};

export default withSessionRoute(handler);

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  const { id, sid } = req.query;
  if (!id || !sid)
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  const { date, timezoneOffset, sessionTagId } = req.body;
  if (!date)
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  const day = new Date(date);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const user = await prisma.user.findUnique({
    where: {
      userid: BigInt(req.session.userid),
    },
    include: {
      roles: {
        where: {
          workspaceGroupId: parseInt(req.query.id as string),
        },
      },
      workspaceMemberships: {
        where: {
          workspaceGroupId: parseInt(req.query.id as string),
        },
      },
    },
  });

  const membership = user?.workspaceMemberships[0];
  const isAdmin = membership?.isAdmin || false;

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: sid as string,
      Days: {
        has: day.getUTCDay(),
      },
    },
    include: {
      sessionType: true,
      sessions: {
        take: 1,
        orderBy: { date: 'desc' },
      },
    },
  });
  

  const existingSessionType = schedule?.sessions?.[0]?.type?.toLowerCase() || 'other';
  const validTypes = ['shift', 'training', 'event', 'other'];
  const type = validTypes.includes(existingSessionType) ? existingSessionType : 'other';
  const userRoles = user?.roles || [];
  const hasHostPermission = userRoles.some((ur: any) => Array.isArray(ur.permissions) && ur.permissions.includes(`sessions_${type}_host`));
  const hasAdminPerm = userRoles.some((ur: any) => Array.isArray(ur.permissions) && ur.permissions.includes("admin"));

  if (!hasHostPermission && !isAdmin && !hasAdminPerm) {
    return res.status(403).json({ success: false, error: "You do not have permission to claim this session" });
  }
  if (!schedule)
    return res.status(400).json({ success: false, error: "Invalid schedule" });
  //get date to utc
  const dateTime = new Date();
  dateTime.setUTCHours(schedule.Hour);
  dateTime.setUTCMinutes(schedule.Minute);
  dateTime.setUTCSeconds(0);
  dateTime.setUTCMilliseconds(0);
  dateTime.setUTCDate(day.getUTCDate());
  dateTime.setUTCMonth(day.getUTCMonth());
  dateTime.setUTCFullYear(day.getUTCFullYear());

  const findSession = await prisma.session.findFirst({
    where: {
      date: dateTime,
      sessionTypeId: schedule.sessionTypeId,
    },
  });
  if (findSession) {
    const updateData: any = {
      ownerId: BigInt(req.session.userid),
    };
    
    if (sessionTagId !== undefined) {
      updateData.sessionTagId = sessionTagId || null;
    }

    const schedulewithsession = await prisma.schedule.update({
      where: {
        id: schedule.id,
      },
      data: {
        sessions: {
          update: {
            where: {
              id: findSession.id,
            },
            data: updateData,
          },
        },
      },
      include: {
        sessionType: true,
        sessions: {
          include: {
            owner: true,
          },
        },
      },
    });

    sendSessionNotification(parseInt(req.query.id as string), 'claim', {
      id: findSession.id,
      name: findSession.name || schedule.sessionType.name,
      type: findSession.type || 'other',
      date: findSession.date,
      duration: (findSession as any).duration || 30,
      hostUserId: Number(req.session.userid),
      sessionTypeName: schedule.sessionType.name,
    }).catch(() => {});

    return res
      .status(200)
      .json({
        success: true,
        session: JSON.parse(
          JSON.stringify(schedulewithsession, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
      });
  }

  const createData: any = {
    date: dateTime,
    sessionTypeId: schedule.sessionTypeId,
    ownerId: req.session.userid,
  };
  
  if (sessionTagId) {
    createData.sessionTagId = sessionTagId;
  }

  const schedulewithsession = await prisma.schedule.update({
    where: {
      id: schedule.id,
    },
    data: {
      sessions: {
        create: createData,
      },
    },
    include: {
      sessionType: true,
      sessions: {
        include: {
          owner: true,
        },
      },
    },
  });

  // Find the newly created session for notification
  const newSession = schedulewithsession.sessions?.find((s: any) =>
    s.date.getTime() === dateTime.getTime()
  );
  if (newSession) {
    sendSessionNotification(parseInt(req.query.id as string), 'claim', {
      id: newSession.id,
      name: (newSession as any).name || schedule.sessionType.name,
      type: (newSession as any).type || 'other',
      date: newSession.date,
      duration: (newSession as any).duration || 30,
      hostUserId: Number(req.session.userid),
      sessionTypeName: schedule.sessionType.name,
    }).catch(() => {});
  }

  res
    .status(200)
    .json({
      success: true,
      session: JSON.parse(
        JSON.stringify(schedulewithsession, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ),
    });
}
