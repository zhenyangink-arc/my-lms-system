"use client";

import { useEffect } from "react";

/**
 * <details id="..."> 默认是折叠的：URL 带 #course-xxx 这类锚点跳转过来时，
 * 浏览器只会滚到 summary 那一行，里面的课时列表仍然收着，看起来像什么都没有。
 * hash 只有客户端才知道，服务端组件没法直接按它渲染 open 属性，这里用一个
 * 不渲染任何内容的小客户端组件挂载后把命中的 <details> 和它的祖先一起展开。
 */
export function AnchorDetailsOpener() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const target = document.getElementById(hash);
    if (!target) return;

    let current: HTMLElement | null = target;
    while (current) {
      if (current instanceof HTMLDetailsElement) current.open = true;
      current = current.parentElement;
    }

    target.scrollIntoView({ block: "start" });
  }, []);

  return null;
}
