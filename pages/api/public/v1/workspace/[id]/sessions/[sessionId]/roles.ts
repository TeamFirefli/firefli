import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { validateApiKey } from "@/utils/api-auth";
import { withPublicApiRateLimit } from "@/utils/prtl";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey) {
    return res.status(401).json({ success: false, error: "Missing API key" });
  }

  const workspaceId = Number.parseInt(req.query.id as string);
  const sessionId = req.query.sessionId as string;

  if (!workspaceId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });
  }

  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing session ID" });
  }

  try {
    const key = await validateApiKey(apiKey, workspaceId);
    if (!key) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired API key" });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        sessionType: {
          include: {
            workspace: {
              select: {
                groupId: true,
              },
            },
          },
        },
        users: {
          include: {
            user: {
              select: {
                userid: true,
                username: true,
                displayName: true,
                picture: true,
              },
            },
          },
        },
        owner: {
          select: {
            userid: true,
            username: true,
            displayName: true,
            picture: true,
          },
        },
      },
    });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    if (session.sessionType.workspace.groupId !== workspaceId) {
      return res.status(403).json({
        success: false,
        error: "Session does not belong to this workspace",
      });
    }

    const slots = session.sessionType.slots as any[];
    const roleAssignments = slots.map((slot: any) => {
      const assignments = session.users
        .filter((su) => su.roleID === slot.id)
        .map((su) => ({
          userId: su.userid.toString(),
          username: su.user.username,
          displayName: su.user.displayName,
          picture: su.user.picture,
          slot: su.slot,
        }));

      return {
        roleId: slot.id,
        roleName: slot.name,
        maxSlots: slot.number || 1,
        weight: slot.weight ?? 0,
        categoryId: slot.categoryId ?? null,
        categoryName: slot.categoryName ?? null,
        categoryWeight: slot.categoryWeight ?? 0,
        assignments,
      };
    });

    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        type: session.type,
        date: session.date,
        duration: session.duration,
        owner: session.owner
          ? {
              userId: session.owner.userid.toString(),
              username: session.owner.username,
              displayName: session.owner.displayName,
              picture: session.owner.picture,
            }
          : null,
        sessionTypeName: session.sessionType.name,
        roles: roleAssignments,
      },
    });
  } catch (error) {
    console.error("Error fetching session roles:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export default withPublicApiRateLimit(handler);
