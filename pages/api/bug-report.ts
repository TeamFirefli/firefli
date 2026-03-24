import type { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "@/lib/withSession";
import { validateCsrf, validateCsrfToken } from "@/utils/csrf";
import axios from "axios";

type Data = {
  success: boolean;
  error?: string;
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetAt) rateLimitMap.delete(key);
  }
}, 60 * 1000);

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const webhookUrl = process.env.EZ_BUGS;
  if (!webhookUrl) {
    return res.status(503).json({ success: false, error: "Bug reporting is not configured" });
  }

  if (!req.session?.userid) {
    return res.status(401).json({ success: false, error: "You must be logged in to submit a bug report" });
  }

  if (!validateCsrf(req, res)) {
    return res.status(403).json({ success: false, error: "Invalid request origin" });
  }

  const csrfToken = req.headers["x-csrf-token"] as string | undefined;
  if (!csrfToken || !validateCsrfToken(csrfToken, req.session.userid)) {
    return res.status(403).json({ success: false, error: "Invalid or expired CSRF token" });
  }

  const userId = String(req.session.userid);
  if (!checkRateLimit(userId)) {
    return res.status(429).json({ success: false, error: "Too many bug reports. Please wait before submitting another." });
  }

  const { title, description, severity, page } = req.body ?? {};

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ success: false, error: "A bug title is required" });
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return res.status(400).json({ success: false, error: "A bug description is required" });
  }

  const safeTitle = title.trim().slice(0, 150);
  const safeDescription = description.trim().slice(0, 1500);
  const safeSeverity = ["low", "medium", "high", "critical"].includes(severity) ? severity : "medium";
  const safePage = page && typeof page === "string" ? page.trim().slice(0, 200) : null;

  const severityColors: Record<string, number> = {
    low: 0x57f287,
    medium: 0xfee75c,
    high: 0xed4245,
    critical: 0x8b0000,
  };

  const embed = {
    title: `🐛 Bug Report: ${safeTitle}`,
    description: safeDescription,
    color: severityColors[safeSeverity],
    fields: [
      { name: "Severity", value: safeSeverity.charAt(0).toUpperCase() + safeSeverity.slice(1), inline: true },
      { name: "User ID", value: userId, inline: true },
      ...(safePage ? [{ name: "Page", value: safePage, inline: false }] : []),
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Firefli EZ Bugs" },
  };

  try {
    await axios.post(webhookUrl, { embeds: [embed] }, { timeout: 8000 });
  } catch {
    return res.status(502).json({ success: false, error: "Failed to submit bug report. Please try again." });
  }

  return res.status(200).json({ success: true });
}

export default withSessionRoute(handler);
