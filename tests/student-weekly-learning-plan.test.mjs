import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateWeeklyLearningProgress } from "../src/features/student-weekly-learning-plan/progress.ts";
import { getSeoulWeekRange } from "../src/features/student-weekly-learning-plan/week.ts";

test("韩国时间周边界在周一零点准确切换", () => {
  assert.deepEqual(
    getSeoulWeekRange(new Date("2026-08-16T14:59:59.999Z")),
    {
      weekStartDate: "2026-08-10",
      weekEndDate: "2026-08-17",
      startsAt: "2026-08-09T15:00:00.000Z",
      endsAt: "2026-08-16T15:00:00.000Z",
    },
  );
  assert.deepEqual(
    getSeoulWeekRange(new Date("2026-08-16T15:00:00.000Z")),
    {
      weekStartDate: "2026-08-17",
      weekEndDate: "2026-08-24",
      startsAt: "2026-08-16T15:00:00.000Z",
      endsAt: "2026-08-23T15:00:00.000Z",
    },
  );
});

test("完成率按韩国日期去重并取天数与分钟目标的较低值", () => {
  const progress = calculateWeeklyLearningProgress({
    targetDays: 4,
    targetMinutes: 100,
    learningSeconds: 4_500,
    activityTimestamps: [
      "2026-08-17T01:00:00.000Z",
      "2026-08-17T10:00:00.000Z",
      "2026-08-17T15:10:00.000Z",
    ],
  });

  assert.equal(progress.actualDays, 2);
  assert.equal(progress.actualMinutes, 75);
  assert.equal(progress.daysCompletionPercent, 50);
  assert.equal(progress.minutesCompletionPercent, 75);
  assert.equal(progress.completionPercent, 50);
  assert.equal(progress.goalMet, false);
});

test("迁移包含唯一约束、RLS、自有数据写策略且不授权删除", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202608190018_student_weekly_learning_plans.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /enable row level security/i);
  assert.match(sql, /student_weekly_learning_plans_unique_week/i);
  assert.match(sql, /unique \(tenant_id, student_id, student_app_id, week_start_date\)/i);
  assert.match(sql, /private\.current_student_has_app_access\(/i);
  assert.match(sql, /private\.current_user_can_view_student_activity\(/i);
  assert.match(sql, /timezone\('Asia\/Seoul'/i);
  assert.doesNotMatch(sql, /create policy[^;]+for delete/is);
  assert.doesNotMatch(sql, /grant select, insert, update, delete/i);
});
