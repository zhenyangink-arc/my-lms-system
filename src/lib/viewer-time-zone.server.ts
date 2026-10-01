import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { resolveViewerTimeZone, VIEWER_TIME_ZONE_COOKIE } from "./viewer-time-zone";

/** 当前用户的时区（来自浏览器写入的 cookie）；没有 cookie 或值无效时是首尔。同一次请求只读一次。 */
export const getViewerTimeZone = cache(async (): Promise<string> => {
  const store = await cookies();
  return resolveViewerTimeZone(store.get(VIEWER_TIME_ZONE_COOKIE)?.value);
});
