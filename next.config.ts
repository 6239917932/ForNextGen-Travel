import type { NextConfig } from 'next';
import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isPublicIndexingEnabled } from './lib/seo/indexingPolicy.ts';

const isDevelopment = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://api.razorpay.com https://*.razorpay.com" +
    (isDevelopment ? ' ws: wss:' : ''),
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'frame-src https://www.openstreetmap.org https://api.razorpay.com https://*.razorpay.com',
  "img-src 'self' data: https://images.unsplash.com",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com" +
    (isDevelopment ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
].join('; ');

export const noIndexHeaderSources = [
  '/account/:path*',
  '/admin/:path*',
  '/agent/:path*',
  '/api/:path*',
  '/buses/booking/:path*',
  '/business/audit/:path*',
  '/business/dashboard/:path*',
  '/business/invitations/:path*',
  '/business/members/:path*',
  '/business/reports/:path*',
  '/business/requests/:path*',
  '/business/statements/:path*',
  '/business/support/:path*',
  '/cars/booking/:path*',
  '/flights/booking/:path*',
  '/forgot-password',
  '/hotels/:slug/booking/:path*',
  '/login',
  '/manage-booking/:path*',
  '/partner/:path*',
  '/payments/:path*',
  '/partners/apply',
  '/register',
  '/reset-password',
] as const;

const nextConfig: NextConfig = {
  // Windows sandbox filesystems can reject concurrent output-directory creation.
  // Keep the standard Linux release configuration unchanged.
  ...(process.platform === 'win32' && process.env.NODE_ENV === 'production'
    ? {
        webpack(config: Parameters<NonNullable<NextConfig['webpack']>>[0]) {
          // Pre-create route folders serially, before Webpack emits files concurrently.
          // This avoids intermittent EPERM from recursive mkdir on Windows sandboxes.
          config.plugins.push({
            apply(compiler: {
              hooks: { beforeCompile: { tap: (name: string, callback: () => void) => void } };
              options: { output: { path: string } };
            }) {
              compiler.hooks.beforeCompile.tap('PrepareWindowsRouteDirectories', () => {
                const appRoot = path.join(process.cwd(), 'app');
                const configuredOutput = path.resolve(compiler.options.output.path);
                const outputRoot =
                  path.basename(configuredOutput) === 'chunks'
                    ? path.dirname(configuredOutput)
                    : configuredOutput;
                const buildRoot = path.join(process.cwd(), '.next');
                if (outputRoot !== buildRoot && !outputRoot.startsWith(`${buildRoot}${path.sep}`))
                  return;
                const prepare = (relative: string) => {
                  mkdirSync(path.join(outputRoot, 'app', relative), { recursive: true });
                  mkdirSync(path.join(buildRoot, 'types', 'app', relative), { recursive: true });
                  mkdirSync(path.join(buildRoot, 'static', 'chunks', 'app', relative), {
                    recursive: true,
                  });
                  for (const entry of readdirSync(path.join(appRoot, relative), {
                    withFileTypes: true,
                  })) {
                    if (entry.isDirectory()) prepare(path.join(relative, entry.name));
                  }
                };
                prepare('');
              });
            },
          });
          return config;
        },
      }
    : {}),
  output: process.env.NEXT_OUTPUT_MODE === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  async headers() {
    return [
      ...noIndexHeaderSources.map((source) => ({
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
        source,
      })),
      {
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(isDevelopment
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          ...(!isPublicIndexingEnabled()
            ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }]
            : []),
        ],
        source: '/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        hostname: 'images.unsplash.com',
        protocol: 'https',
      },
    ],
  },
};

export default nextConfig;
