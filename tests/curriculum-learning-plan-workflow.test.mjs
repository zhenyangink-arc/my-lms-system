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
  assert.match(actions, /避开 12 点和 18 点休息时段/);
});

test("课程学习项目绑定真实已发布课时，并由服务端构造学生课程深链", async () => {
  const [actions, sql] = await Promise.all([
    read("src/features/curriculum-plans/actions.ts"),
    read("supabase/migrations/202609050005_curriculum_plan_lesson_source_integrity.sql"),
  ]);
  assert.match(actions, /课程学习必须绑定该计划课程中的真实课时/);
  assert.match(actions, /\.from\("lessons"\)/);
  assert.match(actions, /\.eq\("course_id", template\.course_id\)/);
  assert.match(actions, /destinationPath = await resolveLessonDestinationPath\(supabase, lesson, access\.appId\)/);
  assert.match(actions, /return `\/dashboard\/courses\//);
  assert.match(actions, /sourceType = "lesson"/);
  assert.match(sql, /new\.activity_type = 'course'/);
  assert.match(sql, /lesson\.course_id = v_course_id/);
  assert.match(sql, /lesson\.is_published/);
  assert.match(sql, /课程学习项目必须全部绑定真实课时/);
});

test("数据库把老师限制在本人计划和负责学生，并冻结已发布模板", async () => {
  const sql = await read("supabase/migrations/202609050003_curriculum_plan_access_hardening.sql");
  assert.match(sql, /teachers manage own curriculum plans/);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(sql, /teachers manage assigned students in own curriculum plans/);
  assert.match(sql, /tenant_student_assignments/);
  assert.match(sql, /已发布的标准计划不可修改，请建立新版本/);
  assert.match(sql, /curriculum_plan_templates_version_uidx/);
});

test("机构计划与学生分配由单个数据库函数原子发布，RLS 辅助函数避免相互递归", async () => {
  const [sql, actions] = await Promise.all([
    read("supabase/migrations/202609050004_curriculum_plan_atomic_publish.sql"),
    read("src/features/curriculum-plans/actions.ts"),
  ]);
  assert.match(sql, /create or replace function public\.publish_institution_curriculum_plan/);
  assert.match(sql, /insert into public\.institution_curriculum_plans/);
  assert.match(sql, /insert into public\.institution_curriculum_plan_students/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /private\.can_manage_curriculum_plan/);
  assert.match(sql, /private\.student_has_curriculum_template/);
  assert.match(actions, /\.rpc\("publish_institution_curriculum_plan"/);
  assert.doesNotMatch(actions, /assignmentError/);
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
  assert.match(view, /const value = task\.startsAt \?\? task\.dueAt/);
  assert.match(view, /datedTasks\.slice\(0, 1\)/);
  assert.match(view, /data-activity=/);
});
