import { getIronSession, SessionOptions } from "iron-session";
import * as crypto from "crypto";
import zxcvbn from 'zxcvbn';
import {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  NextApiHandler,
  NextApiRequest,
  NextApiResponse,
} from "next";
import { isUserBlocked, logBlockedAccess } from "@/utils/blocklist"; // gitignore

if (process.env.NODE_ENV === 'production') {
  const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
  if (secret === 'supersecretpassword') {
    throw new Error('SESSION_SECRET must be changed from the default secret in production');
  }
  const strength = zxcvbn(secret);
  if (strength.score < 4) { 
    throw new Error(
      `SESSION_SECRET is not strong enough. Score: ${strength.score}/4. Please generate a secret, e.g using "openssl rand -base64 32" or use a password manager to generate a secure password.`
    );
  }
}

const code = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const sessionOptions: SessionOptions = {
  password: code,
  cookieName: "firefli_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
  },
  ttl: 60 * 60 * 24 * 7, // 1 week
};

export function withSessionRoute(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // @ts-ignore
    req.session = await getIronSession(req, res, sessionOptions);
    
    // Check if the user's session should be revoked due to blocklist
    // @ts-ignore
    if (req.session.userid && isUserBlocked(req.session.userid)) {
      // @ts-ignore
      logBlockedAccess(req.session.userid, 'active session');
      // Destroy the session immediately
      req.session.destroy();
      
      // Return 401 Unauthorized for API routes
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied',
        blocked: true
      });
    }
    
    return handler(req, res);
  };
}

// Theses types are compatible with InferGetStaticPropsType https://nextjs.org/docs/basic-features/data-fetching#typescript-use-getstaticprops
export function withSessionSsr<
  P extends { [key: string]: unknown } = { [key: string]: unknown },
>(
  handler: (
    context: GetServerSidePropsContext & { req: any }
  ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>,
) {
  return async (context: GetServerSidePropsContext) => {
    // @ts-ignore
    context.req.session = await getIronSession(context.req, context.res, sessionOptions);
    
    // Check if the user's session should be revoked due to blocklist
    // @ts-ignore
    if (context.req.session.userid && isUserBlocked(context.req.session.userid)) {
      // @ts-ignore
      logBlockedAccess(context.req.session.userid, 'SSR page access');
      // Destroy the session
      context.req.session.destroy();
      
      // Redirect to login page
      return {
        redirect: {
          destination: '/login?error=access_denied',
          permanent: false,
        },
      };
    }
    
    return handler(context as any);
  };
}