import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  ...(process.env.R2_ACCOUNT_ID
    ? {
        images: {
          remotePatterns: [
            {
              protocol: "https" as const,
              hostname: `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
              pathname: "/**",
            },
          ],
        },
      }
    : {}),
  allowedDevOrigins: [
    "127.0.0.1",
    "127.0.0.2",
    "127.0.0.3",
    "100.125.173.55",
    "kmgwak-system-product-name.taila18cd5.ts.net",
  ],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
