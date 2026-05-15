import rateLimit from "express-rate-limit";
import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";

const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, 
  message: { success: false, error: "Rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const workspaceId = req.url?.match(/\/workspace\/([^/?]+)/)?.[1] ?? "global";
    const apiKey = (req as any).headers?.authorization?.replace("Bearer ", "") || "";
    if (apiKey) return `apikey:${apiKey}:workspace:${workspaceId}`;

    const cfIp = (req as any).headers?.["cf-connecting-ip"];
    const xRealIp = (req as any).headers?.["x-real-ip"];
    const forwarded = (req as any).headers?.["x-forwarded-for"];
    const remoteAddress = (req as any).socket?.remoteAddress;
    return `ip:${cfIp || xRealIp || forwarded?.split(",")[0] || remoteAddress || "unknown"}:workspace:${workspaceId}`;
  },
});

export function withPublicApiRateLimit(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await new Promise<void>((resolve, reject) => {
        publicApiLimiter(req as any, res as any, (result: unknown) => {
          if (result instanceof Error) reject(result);
          resolve();
        });
      });
      return handler(req, res);
    } catch {
      return res.status(429).json({
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      });
    }
  };
}

export { publicApiLimiter };