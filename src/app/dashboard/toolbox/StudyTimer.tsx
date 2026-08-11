"use client";

import { useEffect, useRef } from "react";
import { recordToolboxStudyTime } from "./actions";

/**
 * 成长工具箱练习计时：页面可见时每秒累计，每 30 秒上报一次增量，
 * 离开页面/切换标签页/组件卸载时把剩余秒数上报，按天写入 learning_time_log。
 * 无任何可见 UI。
 */
export function ToolboxStudyTimer({ skill }: { skill: string }) {
  const secondsRef = useRef(0);
  const skillRef = useRef(skill);

  useEffect(() => {
    secondsRef.current = 0;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") secondsRef.current += 1;
    }, 1000);

    const flush = () => {
      const s = secondsRef.current;
      if (s > 0) {
        secondsRef.current = 0;
        recordToolboxStudyTime(skillRef.current, s).catch(() => {});
      }
    };

    const flushInterval = setInterval(flush, 30 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onPageHide = () => flush();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      clearInterval(flushInterval);
      flush();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
