"use client";

import { useEffect } from "react";

import { markAnnouncementsReadAction } from "./actions";

export function AnnouncementReadTracker({ announcementIds }: { announcementIds: string[] }) {
  useEffect(() => {
    void markAnnouncementsReadAction(announcementIds).catch(() => {
      // 阅读回执失败不阻断公告正文；用户下次进入时会再次尝试。
    });
  }, [announcementIds]);

  return null;
}
