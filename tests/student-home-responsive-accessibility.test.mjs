import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("门户顶栏在手机端收敛内容且保持 44px 核心触控区", async () => {
  const [topbar, accountMenu, portal] = await Promise.all([
    source("src/app/[space]/PortalTopbar.tsx"),
    source("src/app/[space]/PortalAccountMenu.tsx"),
    source("src/app/[space]/page.tsx"),
  ]);

  assert.match(topbar, /px-4[^"]*sm:px-6[^"]*lg:px-8/);
  assert.match(topbar, /className="hidden shrink-0 items-center gap-1 lg:flex"/);
  assert.match(topbar, /hidden max-w-28 truncate[^"]*sm:block/);
  assert.match(topbar, /h-11 shrink-0[^"]*sm:px-4/);
  assert.match(accountMenu, /className="hidden max-w-32 leading-tight md:block"/);
  assert.match(accountMenu, /className="flex h-11 items-center/);
  assert.match(portal, /focus:min-h-11/);
});

test("标题提示支持悬停、聚焦、触屏点击、外部关闭和可访问名称", async () => {
  const hint = await source("src/components/ui/card-title-with-hint.tsx");
  assert.match(hint, /aria-label=\{hintLabel\}/);
  assert.match(hint, /aria-expanded=\{isOpen\}/);
  assert.match(hint, /onMouseEnter=\{openHint\}/);
  assert.match(hint, /onFocus=\{openHint\}/);
  assert.match(hint, /onClick=\{\(\) =>/);
  assert.match(hint, /document\.addEventListener\("pointerdown", closeOnOutsidePointer\)/);
  assert.match(hint, /h-11 w-11/);
  assert.match(hint, /role="tooltip"/);
});

test("新增概览在窄屏使用数据卡且交互入口满足触控尺寸", async () => {
  const [institution, growth] = await Promise.all([
    source("src/features/institution-platform-overview/components/institution-platform-overview.tsx"),
    source("src/app/dashboard/SystemGrowthHomeView.tsx"),
  ]);
  assert.doesNotMatch(institution, /overflow-x-auto|min-w-\[(42|64)rem\]/);
  assert.match(institution, /className="divide-y sm:hidden"/);
  assert.match(institution, /className="grid gap-3 p-3 sm:grid-cols-2 xl:hidden"/);
  assert.match(institution, /className="hidden xl:block"/);
  assert.match(institution, /<summary className="flex min-h-11/);
  assert.match(growth, /href=\{recordsHref\} className="inline-flex min-h-11/);
  assert.doesNotMatch(growth, /text-\[11px\]/);
});

test("状态同时使用图标和文字，摘要加载失败提供恢复入口", async () => {
  const [teacher, portal, korean, institution, styles] = await Promise.all([
    source("src/features/teacher-class-today/components/teacher-class-today-dashboard.tsx"),
    source("src/app/[space]/page.tsx"),
    source("src/app/dashboard/DailyLearningWorkspace.tsx"),
    source("src/features/institution-platform-overview/components/institution-platform-overview.tsx"),
    source("src/app/globals.css"),
  ]);

  assert.match(teacher, /const taskStatusIcons:[\s\S]+not_started: Circle,[\s\S]+overdue: CircleAlert/);
  assert.match(teacher, /<Icon size=\{13\} aria-hidden="true" \/>[\s\n]+\{taskStatusLabels\[status\]\}/);
  assert.match(portal, /摘要加载失败/);
  assert.match(portal, /href=\{portalPath\}[\s\S]+重新加载/);
  assert.match(korean, /今日学习暂时无法加载/);
  assert.match(institution, /学习概览加载失败/);
  assert.match(styles, /\.student-system-welcome-eyebrow \{[\s\S]*?font-size: 12px;/);
  assert.match(styles, /\.student-system-welcome-status small \{[\s\S]*?font-size: 12px;/);
});
