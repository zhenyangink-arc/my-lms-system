"use client";

import { useEffect, useRef } from "react";

import { markAnnouncementsReadAction } from "./actions";

const FLUSH_DELAY_MS = 800;

let pendingIds: Set<string> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushPendingReads() {
  flushTimer = null;
  const ids = pendingIds ? [...pendingIds] : [];
  pendingIds = null;
  if (ids.length === 0) return;
  void markAnnouncementsReadAction(ids).catch(() => {
    // 阅读回执失败不影响正文展示；用户下次滚动到时会再次尝试。
  });
}

function queueAnnouncementRead(announcementId: string) {
  if (!pendingIds) pendingIds = new Set();
  pendingIds.add(announcementId);
  if (!flushTimer) flushTimer = setTimeout(flushPendingReads, FLUSH_DELAY_MS);
}

// 公告卡片真正滚动进可视区域才标记已读，而不是整页一加载就把所有公告
// （哪怕还在屏幕外）全部标记已读——避免学生没看到某条紧急公告就被判定为已读。
export function AnnouncementReadTracker({ announcementId }: { announcementId: string }) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          queueAnnouncementRead(announcementId);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [announcementId]);

  return <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />;
}
