"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import {
  DEFAULT_VIEWER_TIME_ZONE,
  isValidTimeZone,
  VIEWER_TIME_ZONE_COOKIE,
} from "@/lib/viewer-time-zone";

const subscribeNothing = () => () => {};

function readBrowserTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(zone) ? zone : DEFAULT_VIEWER_TIME_ZONE;
}

/**
 * 客户端组件里的用户时区：浏览器所在时区；服务端渲染时先用首尔，水合后立即换成浏览器时区
 * （useSyncExternalStore 保证这一步不会触发水合错误）。
 */
export function useViewerTimeZone(): string {
  return useSyncExternalStore(subscribeNothing, readBrowserTimeZone, () => DEFAULT_VIEWER_TIME_ZONE);
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * 把浏览器时区写进 cookie，服务端渲染的页面据此按用户电脑的时区显示时间。
 * cookie 缺失或与浏览器时区不一致时写入并刷新一次当前路由，让已渲染的内容换成正确的时区；
 * 之后每次访问值一致，不再刷新。放在根布局里，每次完整加载最多执行一次。
 */
export function ViewerTimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const zone = readBrowserTimeZone();
    if (readCookie(VIEWER_TIME_ZONE_COOKIE) === zone) return;
    document.cookie = `${VIEWER_TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
