import type { NextRequest } from "next/server";

import { proxy } from "@/lib/dashboard-request-routing";

// OpenNext currently supports Edge Middleware, but not Next.js Node.js Proxy.
// Keep this compatibility entry until the Cloudflare adapter supports Node Proxy.
export function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/platform/dashboard/:path*",
    "/t/:tenantSlug/dashboard/:path*",
  ],
};
