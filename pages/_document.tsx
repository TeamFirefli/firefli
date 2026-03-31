import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://m.firefli.net https://cdn.posthog.com https://js.posthog.com https://cdn.intercom.com https://uploads.intercomcdn.com https://js.intercomcdn.com https://widget.intercom.io; " +
            "script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com/ https://*.posthog.com https://m.firefli.net https://cdn.posthog.com https://js.posthog.com https://cdn.intercom.com https://uploads.intercomcdn.com https://js.intercomcdn.com https://widget.intercom.io; " +
            "script-src-attr 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com https://fonts.intercomcdn.com; " +
            "img-src 'self' data: https: blob:; " +
            "connect-src 'self' https://m.firefli.net https://events.posthog.com https://app.posthog.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com https://apis.roblox.com https://thumbnails.roblox.com https://users.roblox.com https://api-iam.intercom.io https://api-iam.eu.intercom.io https://api-iam.au.intercom.io wss://nexus-websocket-a.intercom.io wss://nexus-websocket-b.intercom.io wss://*.intercom.io; " +
            "media-src 'self' https://audio-ssl.itunes.apple.com https://cdn.freesound.org; " +
            "frame-src 'self' https://www.youtube.com; " +
            "frame-ancestors 'self'; " +
            "base-uri 'self'; form-action 'self';"
          }
        />
        {/* Prevent MIME type sniffing */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        {/* Additional XSS protection */}
        <meta httpEquiv="X-XSS-Protection" content="0" />
        {/* Control referrer information */}
        <meta
          httpEquiv="Referrer-Policy"
          content="strict-origin-when-cross-origin"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
