"use client";

import { useCallback, useRef, useState, type FocusEvent } from "react";

// 桌面靠 hover 展开、移动端靠 click 展开：触屏设备本身不触发 mouseenter，
// 所以同一套 handleProps 在两种输入方式下都能工作，不需要单独判断设备类型。
export function useHoverDrawer(closeDelay = 220) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const closeWithDelay = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), closeDelay);
  }, [clearCloseTimer, closeDelay]);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  // 触柄和抽屉内容分属两棵 DOM 子树（抽屉内容渲染在 Portal 里），
  // 用 relatedTarget 判断焦点是否真的离开了当前子树，避免 Tab 键在两者之间移动时误关闭。
  const handleBlur = useCallback(
    (event: FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        closeWithDelay();
      }
    },
    [closeWithDelay]
  );

  const panelBlur = useCallback(
    (event: FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        closeWithDelay();
      }
    },
    [closeWithDelay]
  );

  const handleProps = {
    onMouseEnter: openNow,
    onFocus: openNow,
    onClick: toggle,
    onBlur: handleBlur,
  };

  const panelProps = {
    onMouseEnter: clearCloseTimer,
    onFocus: clearCloseTimer,
    onMouseLeave: closeWithDelay,
    onBlur: panelBlur,
  };

  return { open, setOpen, handleProps, panelProps };
}
