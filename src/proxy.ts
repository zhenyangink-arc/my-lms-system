import type { NextRequest } from "next/server";

import { proxy as routeDashboardRequest } from "@/lib/dashboard-request-routing";

export function proxy(request: NextRequest) {
  return routeDashboardRequest(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/platform/dashboard/:path*",
    "/t/:tenantSlug/dashboard/:path*",
  ],
};
