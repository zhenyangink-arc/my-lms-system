import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("门户顶栏在手机端收敛内容且保持 44px 核心触控区", async () => {
  const [topbar, appSwitcher, notificationMenu, accountMenu, profileView, profileDialog, profileForm, portal] = await Promise.all([
    source("src/app/[space]/PortalTopbar.tsx"),
    source("src/app/[space]/PortalAppSwitcher.tsx"),
    source("src/app/[space]/PortalNotificationMenu.tsx"),
    source("src/app/[space]/PortalAccountMenu.tsx"),
    source("src/app/dashboard/profile/ProfileView.tsx"),
    source("src/app/dashboard/profile/ProfileDialogView.tsx"),
    source("src/app/dashboard/profile/ProfileForm.tsx"),
    source("src/app/[space]/page.tsx"),
  ]);

  assert.match(topbar, /px-3[^"]*sm:px-5[^"]*lg:px-6/);
  assert.match(topbar, /className="hidden shrink-0 items-center gap-1 lg:flex"/);
  assert.match(topbar, /hidden max-w-28 truncate[^"]*sm:block/);
  assert.match(topbar, /<PortalAppSwitcher apps=\{apps\} \/>/);
  assert.doesNotMatch(topbar, /max-w-7xl/);
  assert.match(appSwitcher, /className="group inline-flex h-11 shrink-0/);
  assert.match(appSwitcher, /<span className="hidden sm:inline">/);
  assert.match(appSwitcher, /aria-label=\{available \? "选择要进入的应用"/);
  assert.doesNotMatch(topbar, /PortalRewardsMenu/);
  assert.match(topbar, /<PortalNotificationMenu/);
  assert.match(notificationMenu, /className="relative inline-flex h-11 w-11 shrink-0/);
  assert.match(notificationMenu, /`消息中心，共 \$\{count\} 条提示`/);
  assert.match(notificationMenu, /aria-hidden="true"[\s\S]+bg-rose-500/);
  assert.match(notificationMenu, /max-w-\[calc\(100vw-2rem\)\]/);
  assert.match(notificationMenu, /w-\[min\(64rem,calc\(100vw-2rem\)\)\]/);
  assert.match(notificationMenu, /md:grid-cols-3/);
  assert.match(notificationMenu, /title="平台提示"/);
  assert.match(notificationMenu, /title="老师提示"/);
  assert.match(notificationMenu, /title="学习消息"/);
  assert.match(accountMenu, /className="hidden max-w-32 leading-tight md:block"/);
  assert.match(accountMenu, /className="flex h-11 items-center/);
  assert.match(accountMenu, /sm:max-w-2xl/);
  assert.doesNotMatch(accountMenu, /1180px/);
  assert.match(accountMenu, /aria-label=\{activeDialog === "profile" \? "关闭个人资料"/);
  assert.match(profileView, /if \(embedded\) \{[\s\S]+<ProfileDialogSummary/);
  assert.match(profileView, /role="progressbar"/);
  assert.match(profileDialog, /编辑个人资料/);
  assert.match(profileDialog, /返回资料概览/);
  assert.doesNotMatch(profileDialog, /next\/link|href=/);
  assert.match(profileForm, /if \(simple\) \{[\s\S]+<ProfileDialogSection/);
  assert.match(profileForm, /sm:grid-cols-2/);
  assert.match(profileForm, /fieldset className="border-0 border-b border-slate-200/);
  assert.match(profileForm, /min-h-11 w-full rounded-lg/);
  assert.match(portal, /focus:min-h-11/);
  assert.doesNotMatch(portal, /max-w-7xl/);
  assert.match(portal, /id="learning-summary"/);
  assert.match(portal, /id="student-apps"/);
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

test("能力画像使用受控聚合读取，局部失败不会触发开发错误层", async () => {
  const [abilityService, portal] = await Promise.all([
    source("src/features/student-ability-portrait/api/service.ts"),
    source("src/app/[space]/page.tsx"),
  ]);

  assert.match(abilityService, /createAdminClient/);
  assert.match(
    abilityService,
    /admin[\s\S]+from\("student_grade_skill_profiles"\)[\s\S]+eq\("tenant_id", tenantId\)[\s\S]+eq\("student_id", studentId\)[\s\S]+eq\("student_app_id", STUDENT_APP_IDS\.korean\)/,
  );
  assert.match(portal, /能力数据暂时无法读取/);
  assert.doesNotMatch(portal, /console\.error/);
});
