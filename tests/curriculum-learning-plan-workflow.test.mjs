import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("学习计划迁移包含平台模板、明细、机构执行和学生分配四层实体", async () => {
  const sql = await read("supabase/migrations/202609050001_curriculum_learning_plan_workflow.sql");
  for (const table of [
    "curriculum_plan_templates",
    "curriculum_plan_template_items",
    "institution_curriculum_plans",
    "institution_curriculum_plan_students",
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /status in \('draft', 'published', 'retired'\)/);
  assert.match(sql, /assigned students read institution curriculum plans/);
  assert.match(sql, /students read own curriculum plan assignment/);
});

test("平台发布后模板明细冻结，机构结束时间由完整相对流程计算", async () => {
  const [sql, time] = await Promise.all([
    read("supabase/migrations/202609050001_curriculum_learning_plan_workflow.sql"),
    read("src/features/curriculum-plans/time.ts"),
  ]);
  assert.match(sql, /已发布或停用的标准计划不能修改明细/);
  assert.match(time, /finalMinute - anchor/);
  assert.match(time, /itemOffsetMinutes\(item\) \+ item\.durationMinutes/);
});

test("机构发布动作重新鉴权、校验学生应用开通状态和老师负责范围", async () => {
  const actions = await read("src/features/curriculum-plans/actions.ts");
  assert.match(actions, /requireManagementAppAccess\(space, appSlug\)/);
  assert.match(actions, /student_app_enrollments/);
  assert.match(actions, /tenant_student_assignments/);
  assert.match(actions, /老师只能向自己负责的学生发布计划/);
});

test("学生周表只读取机构正式发布计划，不回退展示自动推荐任务", async () => {
  const [page, view] = await Promise.all([
    read("src/app/dashboard/DashboardHomePage.tsx"),
    read("src/app/dashboard/SystemGrowthHomeView.tsx"),
  ]);
  assert.match(page, /loadPublishedStudentCurriculumTasks/);
  assert.match(page, /weeklyPlanTasks=\{weeklyPlanTasks\}/);
  assert.match(view, /<WeeklyLearningPlan tasks=\{weeklyPlanTasks\}/);
  assert.doesNotMatch(view, /todayFallback/);
});
