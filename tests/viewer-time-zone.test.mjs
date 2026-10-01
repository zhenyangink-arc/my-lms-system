import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  daysBetweenDateKeys,
  DEFAULT_VIEWER_TIME_ZONE,
  formatDateKey,
  formatInTimeZone,
  hourInTimeZone,
  isValidTimeZone,
  resolveViewerTimeZone,
  startOfDayInTimeZone,
  weekdayOfDateKey,
  weekStartKeyInTimeZone,
  zonedTimeToDate,
} from "../src/lib/viewer-time-zone.ts";

test("用户时区：无效值回落到首尔，有效值原样使用", () => {
  assert.equal(DEFAULT_VIEWER_TIME_ZONE, "Asia/Seoul");
  for (const bad of [undefined, null, "", "Mars/Base", "x".repeat(80), 7]) assert.equal(resolveViewerTimeZone(bad), "Asia/Seoul", String(bad));
  for (const good of ["America/New_York", "Asia/Shanghai", "UTC", "Europe/London"]) {
    assert.equal(isValidTimeZone(good), true, good);
    assert.equal(resolveViewerTimeZone(good), good);
  }
});

test("同一时间点在不同时区落在不同的日期和小时（跨日、夏令时）", () => {
  const instant = "2026-10-01T20:00:00Z";
  assert.equal(dateKeyInTimeZone(instant, "Asia/Seoul"), "2026-10-02"); // 05:00
  assert.equal(dateKeyInTimeZone(instant, "Asia/Shanghai"), "2026-10-02"); // 04:00
  assert.equal(dateKeyInTimeZone(instant, "America/New_York"), "2026-10-01"); // 16:00 夏令时
  assert.equal(dateKeyInTimeZone(instant, "Europe/London"), "2026-10-01"); // 21:00
  assert.equal(hourInTimeZone(instant, "Asia/Seoul"), 5);
  assert.equal(hourInTimeZone(instant, "America/New_York"), 16);
  assert.equal(hourInTimeZone("2026-10-01T15:30:00Z", "Asia/Seoul"), 0); // 午夜是 0 不是 24
  assert.equal(dateKeyInTimeZone(new Date("2026-12-31T23:30:00Z"), "Asia/Seoul"), "2027-01-01");
});

test("日期键本身是日历日期：格式化、星期、加减天数都与时区无关", () => {
  // 与“当天中午的 UTC 时间点按 UTC 格式化”完全一致（不同 ICU 版本的具体文字不同，所以不写死）
  const noon = new Date(Date.UTC(2026, 9, 2, 12));
  for (const options of [{ month: "numeric", day: "numeric" }, { year: "numeric", month: "long", day: "numeric" }]) {
    assert.equal(formatDateKey("2026-10-02", options), new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: "UTC" }).format(noon));
  }
  assert.match(formatDateKey("2026-10-02", { year: "numeric", month: "long", day: "numeric" }), /2026.*10.*2/);
  assert.equal(weekdayOfDateKey("2026-10-01"), 4); // 周四
  assert.equal(weekdayOfDateKey("2026-10-04"), 0); // 周日
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToDateKey("2026-03-01", -1), "2026-02-28");
});

test("按时区格式化时间点", () => {
  const instant = "2026-10-01T20:00:00Z";
  assert.equal(formatInTimeZone(instant, "Asia/Seoul", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }), "05:00");
  assert.equal(formatInTimeZone(instant, "America/New_York", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }), "16:00");
});

test("某时区某天零点：首尔 / 纽约，含夏令时开始与结束当天", () => {
  assert.equal(startOfDayInTimeZone("2026-10-02", "Asia/Seoul").toISOString(), "2026-10-01T15:00:00.000Z");
  assert.equal(startOfDayInTimeZone("2026-10-02", "Asia/Shanghai").toISOString(), "2026-10-01T16:00:00.000Z");
  assert.equal(startOfDayInTimeZone("2026-10-02", "America/New_York").toISOString(), "2026-10-02T04:00:00.000Z"); // UTC-4
  assert.equal(startOfDayInTimeZone("2026-12-02", "America/New_York").toISOString(), "2026-12-02T05:00:00.000Z"); // UTC-5
  // 美国 2026-03-08 夏令时开始：当天 00:00 仍是 UTC-5；2026-11-01 结束：当天 00:00 是 UTC-4
  assert.equal(startOfDayInTimeZone("2026-03-08", "America/New_York").toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(startOfDayInTimeZone("2026-11-01", "America/New_York").toISOString(), "2026-11-01T04:00:00.000Z");
  // 与日期键往返一致
  for (const tz of ["Asia/Seoul", "America/New_York", "Europe/London", "Pacific/Auckland"]) {
    const start = startOfDayInTimeZone("2026-10-02", tz);
    assert.equal(dateKeyInTimeZone(start, tz), "2026-10-02", tz);
    assert.equal(dateKeyInTimeZone(new Date(start.getTime() - 1000), tz), "2026-10-01", tz);
  }
});

test("某时区某天的某个钟点，以及所在周的周一", () => {
  assert.equal(zonedTimeToDate("2026-10-02", 9, 0, "Asia/Seoul").toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(zonedTimeToDate("2026-10-02", 9, 0, "America/New_York").toISOString(), "2026-10-02T13:00:00.000Z");
  assert.equal(zonedTimeToDate("2026-03-08", 9, 30, "America/New_York").toISOString(), "2026-03-08T13:30:00.000Z"); // 夏令时开始当天 09:30 已是 UTC-4
  // 2026-10-04 是周日：同一时间点在首尔已是周日（属于 9-28 那一周），在纽约 10-03 周六
  assert.equal(weekStartKeyInTimeZone("2026-10-04T00:30:00Z", "Asia/Seoul"), "2026-09-28");
  assert.equal(weekStartKeyInTimeZone("2026-10-05T20:00:00Z", "Asia/Seoul"), "2026-10-05"); // 首尔 10-06 周二 05:00，所在周的周一是 10-05
  assert.equal(weekStartKeyInTimeZone("2026-10-05T20:00:00Z", "America/New_York"), "2026-10-05");
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isSamePortalDay, isTomorrowInPortal, selectRequiredTodayTasks } from "../src/features/student-home-learning/api/required-today.ts";
import { getTaskTiming } from "../src/features/student-home-learning/presentation.ts";

const read = (path) => readFileSync(join(new URL("..", import.meta.url).pathname, path), "utf8");

test("今日任务的“今天 / 明天”按用户时区划分；不传时区时与改动前一致（首尔）", () => {
  const now = new Date("2026-10-01T10:00:00Z"); // 首尔 10-01 19:00，纽约 10-01 06:00
  const due = "2026-10-01T20:00:00Z"; // 首尔 10-02 05:00，纽约 10-01 16:00
  assert.equal(isSamePortalDay(due, now), false); // 默认首尔：明天
  assert.equal(isTomorrowInPortal(due, now), true);
  assert.equal(isSamePortalDay(due, now, "Asia/Seoul"), false);
  assert.equal(isSamePortalDay(due, now, "America/New_York"), true); // 纽约：今天
  assert.equal(isTomorrowInPortal(due, now, "America/New_York"), false);

  const task = { required: true, status: "available", dueAt: due, startsAt: null, priority: "normal" };
  assert.equal(selectRequiredTodayTasks([task], now).length, 0);
  assert.equal(selectRequiredTodayTasks([task], now, "America/New_York").length, 1);
});

test("日期键之间相差的天数与时区无关，跨月跨年也对", () => {
  assert.equal(daysBetweenDateKeys("2026-10-02", "2026-10-02"), 0);
  assert.equal(daysBetweenDateKeys("2026-10-02", "2026-10-05"), 3);
  assert.equal(daysBetweenDateKeys("2026-10-02", "2026-09-30"), -2);
  assert.equal(daysBetweenDateKeys("2026-12-30", "2027-01-02"), 3);
  assert.equal(daysBetweenDateKeys("2026-03-07", "2026-03-09"), 2); // 跨美国夏令时切换日
});

test("任务时间文字按用户时区显示", () => {
  const base = { dueAt: "2026-10-01T10:00:00.000Z", progressPercent: null, status: "available" };
  assert.match(getTaskTiming(base), /10\/1 19:00 截止/); // 默认首尔
  assert.match(getTaskTiming(base, "America/New_York"), /10\/1 06:00 截止/);
  assert.match(getTaskTiming(base, "Asia/Shanghai"), /10\/1 18:00 截止/);
});

test("用户时区机制的接线：根布局同步 cookie，服务端读 cookie 并回落首尔，改过的页面不再写死首尔", () => {
  assert.match(read("src/app/layout.tsx"), /<ViewerTimeZoneSync \/>/);
  const sync = read("src/components/viewer-time-zone.tsx");
  assert.match(sync, /document\.cookie = `\$\{VIEWER_TIME_ZONE_COOKIE\}=/);
  assert.match(sync, /router\.refresh\(\)/);
  assert.match(sync, /useSyncExternalStore\(subscribeNothing, readBrowserTimeZone, \(\) => DEFAULT_VIEWER_TIME_ZONE\)/);
  const server = read("src/lib/viewer-time-zone.server.ts");
  assert.match(server, /resolveViewerTimeZone\(store\.get\(VIEWER_TIME_ZONE_COOKIE\)\?\.value\)/);
  // 这些文件已改为用户时区：不应再出现 Asia/Seoul
  for (const path of [
    "src/app/dashboard/records/page-content.tsx",
    "src/app/dashboard/records/LearningRecordBoard.tsx",
    "src/app/dashboard/records/YearLearningCalendar.tsx",
    "src/app/dashboard/records/learning-record-types.ts",
    "src/app/dashboard/StudentTopbar.tsx",
    "src/app/dashboard/StudentSystemTopbar.tsx",
    "src/app/dashboard/StudentSubjectHome.tsx",
    "src/app/[space]/page.tsx",
    "src/app/dashboard/admin/apps/ManagementApplicationAssessmentPage.tsx",
    "src/app/dashboard/admin/apps/PlatformAssessmentPaperCatalog.tsx",
    "src/app/dashboard/admin/apps/ManagementStudyAbroadInsightPage.tsx",
    "src/features/student-home-learning/presentation.ts",
    "src/features/student-home-learning/api/required-today.ts",
    "src/features/student-home-learning/api/task-preferences.ts",
    "src/features/student-home-learning/api/task-preference-service.ts",
    "src/features/student-ability-portrait/api/service.ts",
    "src/features/platform-learning-insights/model.ts",
    "src/features/platform-learning-insights/InstitutionFollowups.tsx",
    // 韩语专用页面与流程
    "src/app/dashboard/DashboardHomePage.tsx",
    "src/app/dashboard/SystemGrowthHomeView.tsx",
    "src/app/dashboard/DailyLearningWorkspace.tsx",
    "src/app/dashboard/documents/page-content.tsx",
    "src/features/course-completion/StudentCompletionPage.tsx",
    "src/features/course-completion/CompletionReviewWorkspace.tsx",
    "src/features/course-completion/CompletionPolicyWorkspace.tsx",
    "src/features/course-completion/review-actions.ts",
    "src/features/curriculum-plans/components/CurriculumPlanWorkspace.tsx",
    "src/features/curriculum-plans/time.ts",
    "src/features/curriculum-plans/actions.ts",
    "src/features/chapter-practice/components/chapter-practice-coverage-listing.tsx",
  ]) {
    assert.doesNotMatch(read(path), /Asia\/Seoul|\+09:00/, path);
  }
  // 页面向下传递用户时区
  assert.match(read("src/app/dashboard/StudentSubjectHome.tsx"), /const timeZone = await getViewerTimeZone\(\)/);
  assert.match(read("src/features/student-home-learning/task-preference-actions.ts"), /timeZone: await getViewerTimeZone\(\)/);
  assert.match(read("src/app/dashboard/DashboardHomePage.tsx"), /const timeZone = await getViewerTimeZone\(\)/);
  assert.match(read("src/app/[space]/apps/korean/grades/completion/page.tsx"), /timeZone=\{await getViewerTimeZone\(\)\}/);
  assert.match(read("src/app/[space]/dashboard/admin/apps/[appSlug]/learning-plans/page.tsx"), /timeZone=\{await getViewerTimeZone\(\)\}/);
  assert.match(read("src/app/[space]/apps/korean/practice/course/page.tsx"), /timeZone/);
});

test("韩语流程里的时间输入按电脑时区换算后提交，服务端不再按 +09:00 猜", () => {
  // 补考开始、截止与学习计划的开课时间：用 LocalDateTimeField（浏览器换算成 UTC ISO），不再是裸 datetime-local
  for (const path of [
    "src/features/course-completion/CompletionReviewWorkspace.tsx",
    "src/features/curriculum-plans/components/CurriculumPlanWorkspace.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /<LocalDateTimeField/, path);
    assert.doesNotMatch(source, /type="datetime-local"/, path);
  }
  assert.match(read("src/features/course-completion/review-actions.ts"), /function parseDateTime\(/);
  assert.match(read("src/features/curriculum-plans/actions.ts"), /parsePlanStartsAt\(text\(formData, "starts_at"\)\)/);
});

test("留学资料截止日按日期相减，不再把日期当成首尔午夜", () => {
  const source = read("src/app/dashboard/documents/page-content.tsx");
  assert.match(source, /daysBetweenDateKeys\(dateKeyInTimeZone\(new Date\(\), timeZone\), dueKey\)/);
  assert.match(source, /formatDateKey\(dueKey, DUE_DATE_OPTIONS\)/);
});
