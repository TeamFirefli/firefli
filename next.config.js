/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	images: {
	  remotePatterns: [
		{
		  protocol: 'https',
		  hostname: 'tr.rbxcdn.com',
		},
	  ],
	},
	env: {
	  NEXT_PUBLIC_DATABASE_CHECK: process.env.DATABASE_URL ? 'true' : '',
	  NEXT_PUBLIC_EZ_BUGS_ENABLED: process.env.EZ_BUGS ? 'true' : '',
	},
	async headers() {
	  return [
		{
		  // Apply these headers to all routes
		  source: '/:path*',
		  headers: [
			{
			  key: 'X-DNS-Prefetch-Control',
			  value: 'on',
			},
			{
			  key: 'X-XSS-Protection',
			  value: '0',
			},
			{
			  key: 'X-Content-Type-Options',
			  value: 'nosniff',
			},
			{
			  key: 'Referrer-Policy',
			  value: 'origin-when-cross-origin',
			},
			{
			  key: 'X-Frame-Options',
			  value: 'SAMEORIGIN',
			},
			{
			  key: 'Content-Security-Policy',
			  value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://widget.intercom.io https://js.intercomcdn.com https://cdn.posthog.com https://js.posthog.com https://cdn.intercom.com https://uploads.intercomcdn.com; script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com/ https://*.posthog.com https://widget.intercom.io https://js.intercomcdn.com https://cdn.posthog.com https://js.posthog.com https://cdn.intercom.com https://uploads.intercomcdn.com; script-src-attr 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://fonts.intercomcdn.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.intercom.io https://events.posthog.com https://app.posthog.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://apis.roblox.com https://thumbnails.roblox.com https://users.roblox.com wss://*.intercom.io; media-src 'self' https://audio-ssl.itunes.apple.com https://cdn.freesound.org; frame-src 'self' https://widget.intercom.io; frame-ancestors 'self'; base-uri 'self'; form-action 'self';",
			},
		  ],
		},
	  ];
	},
  };
  
  module.exports = nextConfig;
