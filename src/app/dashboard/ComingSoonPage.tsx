import type { ReactNode } from "react";

import { DashboardPageHeader } from "./DashboardPageHeader";

/*
  通用"功能即将上线"占位页面。

  使用场景：
  侧边栏菜单已经先加上了，但对应功能还没开发（比如作业与考试、会话练习等）。
  用这个组件避免点进去直接 404，同时清楚告诉用户这不是 bug，是还没做。
*/
export function ComingSoonPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <>
      <DashboardPageHeader title={title} description={description} />

      <div className="w-full p-6">
        <div className="app-card flex flex-col items-center gap-3 rounded-3xl border p-12 text-center shadow-sm">
          <div className="app-soft-card flex h-14 w-14 items-center justify-center rounded-2xl border">
            {icon}
          </div>
          <h3 className="text-lg font-black" style={{ color: "var(--app-text)" }}>
            功能即将上线
          </h3>
          <p className="max-w-md text-sm app-muted-text">
            {title}正在开发中，敬请期待。
          </p>
        </div>
      </div>
    </>
  );
}