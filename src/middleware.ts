import type { NextRequest } from "next/server";

import { proxy } from "./proxy";

// Next.js 15 discovers request interception through middleware.ts.
// Keep the implementation in proxy.ts so the project can migrate to the
// Next.js 16 proxy convention later without duplicating the routing logic.
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
