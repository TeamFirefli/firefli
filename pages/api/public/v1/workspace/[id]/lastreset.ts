import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"
import { getConfig } from "@/utils/configEngine"
import { withPublicApiRateLimit } from "@/utils/prtl"

type ResetSchedule = {
  enabled?: boolean
  day?: string | null
  frequency?: string | null
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const INTERVAL_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 28,
}

const MIN_DAYS_SINCE: Record<string, number> = {
  weekly: 6,
  biweekly: 13,
  monthly: 27,
}

function getNextResetAt(
  now: Date,
  schedule: ResetSchedule,
  lastAutoResetAt: Date | null
): Date | null {
  if (!schedule?.enabled || !schedule.day || !schedule.frequency) {
    return null
  }

  const targetDay = DAY_INDEX[schedule.day]
  const intervalDays = INTERVAL_DAYS[schedule.frequency]
  const minDaysSince = MIN_DAYS_SINCE[schedule.frequency]

  if (targetDay === undefined || !intervalDays || minDaysSince === undefined) {
    return null
  }

  const currentDay = now.getDay()

  if (!lastAutoResetAt) {
    if (currentDay === targetDay) {
      return now
    }

    const next = new Date(now)
    const dayOffset = (targetDay - currentDay + 7) % 7
    next.setDate(next.getDate() + dayOffset)
    return next
  }

  const daysSinceLastAutoReset = Math.floor(
    (now.getTime() - lastAutoResetAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  const shouldResetNow =
    currentDay === targetDay && daysSinceLastAutoReset >= minDaysSince

  if (shouldResetNow) {
    return now
  }

  const earliestEligible = new Date(
    lastAutoResetAt.getTime() + intervalDays * 24 * 60 * 60 * 1000
  )

  const baseDate = earliestEligible > now ? earliestEligible : now
  const baseDay = baseDate.getDay()
  const dayOffset = (targetDay - baseDay + 7) % 7

  const next = new Date(baseDate)
  next.setDate(next.getDate() + dayOffset)

  return next
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) {
    return res.status(401).json({ success: false, error: "Missing API key" })
  }

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: "Missing workspace ID" })
  }

  try {
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    const [lastReset, lastAutoReset, resetSchedule] = await Promise.all([
      prisma.activityReset.findFirst({
        where: { workspaceGroupId: workspaceId },
        orderBy: { resetAt: "desc" },
        select: {
          resetAt: true,
          previousPeriodStart: true,
          previousPeriodEnd: true,
        },
      }),
      prisma.activityReset.findFirst({
        where: {
          workspaceGroupId: workspaceId,
          resetById: null,
        },
        orderBy: { resetAt: "desc" },
        select: { resetAt: true },
      }),
      getConfig("activity_reset_schedule", workspaceId),
    ])

    const now = new Date()
    const nextResetAt = getNextResetAt(now, (resetSchedule || {}) as ResetSchedule, lastAutoReset?.resetAt || null)

    return res.status(200).json({
      success: true,
      reset: {
        lastResetAt: lastReset?.resetAt || null,
        previousPeriodStart: lastReset?.previousPeriodStart || null,
        previousPeriodEnd: lastReset?.previousPeriodEnd || null,
      },
      schedule: {
        enabled: Boolean((resetSchedule as ResetSchedule | null)?.enabled),
        day: (resetSchedule as ResetSchedule | null)?.day || null,
        frequency: (resetSchedule as ResetSchedule | null)?.frequency || null,
      },
      nextResetAt,
    })
  } catch (error) {
    console.error("Error fetching activity reset status:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
