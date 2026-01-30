import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  const noticeId = req.query.noticeId as string

  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })
  if (!noticeId) return res.status(400).json({ success: false, error: "Missing notice ID" })

  try {
    // Validate API key
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    // GET - Retrieve specific notice
    if (req.method === "GET") {
      const notice = await prisma.inactivityNotice.findFirst({
        where: {
          id: noticeId,
          workspaceGroupId: workspaceId,
        },
        include: {
          user: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
      })

      if (!notice) {
        return res.status(404).json({ success: false, error: "Notice not found" })
      }

      return res.status(200).json({
        success: true,
        notice: {
          id: notice.id,
          userId: Number(notice.userId),
          user: {
            userId: Number(notice.user.userid),
            username: notice.user.username,
            thumbnail: notice.user.picture,
          },
          startTime: notice.startTime,
          endTime: notice.endTime,
          reason: notice.reason,
          approved: notice.approved,
          reviewed: notice.reviewed,
          revoked: notice.revoked,
          reviewComment: notice.reviewComment,
        },
      })
    }

    // PATCH - Update notice status
    if (req.method === "PATCH") {
      const { approved, reviewComment, endTime, revoked } = req.body

      const updateData: any = {}

      if (typeof approved === "boolean") {
        updateData.approved = approved
        updateData.reviewed = true
      }

      if (reviewComment !== undefined) {
        updateData.reviewComment = reviewComment
      }

      if (endTime !== undefined) {
        updateData.endTime = endTime ? new Date(endTime) : null
      }

      if (typeof revoked === "boolean") {
        updateData.revoked = revoked
      }

      const notice = await prisma.inactivityNotice.update({
        where: {
          id: noticeId,
        },
        data: updateData,
        include: {
          user: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
      })

      return res.status(200).json({
        success: true,
        notice: {
          id: notice.id,
          userId: Number(notice.userId),
          user: {
            userId: Number(notice.user.userid),
            username: notice.user.username,
            thumbnail: notice.user.picture,
          },
          startTime: notice.startTime,
          endTime: notice.endTime,
          reason: notice.reason,
          approved: notice.approved,
          reviewed: notice.reviewed,
          revoked: notice.revoked,
          reviewComment: notice.reviewComment,
        },
      })
    }

    // DELETE - Stop active notice (set endTime to now)
    if (req.method === "DELETE") {
      const notice = await prisma.inactivityNotice.update({
        where: {
          id: noticeId,
        },
        data: {
          endTime: new Date(),
          revoked: true,
        },
        include: {
          user: {
            select: {
              userid: true,
              username: true,
              picture: true,
            },
          },
        },
      })

      return res.status(200).json({
        success: true,
        message: "Notice stopped successfully",
        notice: {
          id: notice.id,
          userId: Number(notice.userId),
          endTime: notice.endTime,
        },
      })
    }

    return res.status(405).json({ success: false, error: "Method not allowed" })
  } catch (error: any) {
    console.error("Error in public notices API:", error)
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "Notice not found" })
    }
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}
