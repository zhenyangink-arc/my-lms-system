import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("新增计划项目时校验同一天时间段是否与已有项目冲突", async () => {
  const actions = await read("src/features/curriculum-plans/actions.ts");
  assert.match(actions, /eq\("day_offset", day - 1\)/);
  assert.match(actions, /existingStart = Number\(row\.start_minute\)/);
  assert.match(actions, /时间段冲突，请调整开始时间或时长/);
});

test("平台负责人可以把已发布或停用的标准计划复制为新草稿", async () => {
  const actions = await read("src/features/curriculum-plans/actions.ts");
  assert.match(actions, /export async function duplicateCurriculumTemplateAction/);
  assert.match(actions, /status: "draft",\s*\n\s*created_by: access\.userId,/);
  assert.match(actions, /已复制为新草稿，可继续编辑后再发布/);
});

test("新建和复制标准计划都通过同一个函数计算版本号，避免未绑定课程的模板撞上唯一索引", async () => {
  const actions = await read("src/features/curriculum-plans/actions.ts");
  assert.match(actions, /async function nextTemplateVersion/);
  assert.match(actions, /query\.is\("course_id", null\)/);
  const createCalls = actions.match(/nextTemplateVersion\(supabase, access\.appId, [\w.]+\)/g) ?? [];
  assert.equal(createCalls.length, 2, "createCurriculumTemplateAction 和 duplicateCurriculumTemplateAction 都应复用该函数");
});

test("机构或老师可以向已发布计划追加学生，且不能越权分配", async () => {
  const actions = await read("src/features/curriculum-plans/actions.ts");
  assert.match(actions, /export async function addStudentsToInstitutionPlanAction/);
  assert.match(actions, /只能向自己发布的计划追加学生/);
  assert.match(actions, /onConflict: "plan_id,student_id", ignoreDuplicates: true/);
  assert.match(actions, /该计划已结束或尚未发布，无法追加学生/);
});

test("机构工作台展示学生按真实课时进度的开始情况，且学生周计划不再有固定 45 天窗口", async () => {
  const service = await read("src/features/curriculum-plans/api/service.ts");
  assert.match(service, /from\("lesson_progress"\)/);
  assert.match(service, /neq\("status", "not_started"\)/);
  assert.match(service, /trackedStudentCount: planStudentIds\.length/);
  assert.doesNotMatch(service, /45 \* 86_400_000/);
});

test("同一课程下混用不同级别课时会在草稿卡片上提示，课时下拉框按级别分组", async () => {
  const workspace = await read("src/features/curriculum-plans/components/CurriculumPlanWorkspace.tsx");
  assert.match(workspace, /function extractLevelLabel/);
  assert.match(workspace, /该计划混合了 \{mixedLevels\.join/);
  assert.match(workspace, /<optgroup key=\{level\}/);
});

test("学生资料查询走服务端管理客户端，避免老师因 profiles 表没有对应 RLS 策略而看到空学生名单", async () => {
  const service = await read("src/features/curriculum-plans/api/service.ts");
  assert.match(service, /import \{ createAdminClient \} from "@\/lib\/supabase\/admin"/);
  assert.match(service, /createAdminClient\(\)\.from\("profiles"\)\.select\("id,full_name,login_id"\)\.in\("id", studentIds\)/);
});

test("机构负责人和管理员被授权读取所管课程的 lesson_progress，进度徽章才不会对他们始终为空", async () => {
  const sql = await read("supabase/migrations/202609050006_curriculum_plan_progress_visibility.sql");
  assert.match(sql, /create policy "institution leaders read lesson progress for curriculum plans"/);
  assert.match(sql, /on public\.lesson_progress for select to authenticated/);
  assert.match(sql, /'ceo', 'tenant_super_admin'/);
  assert.match(sql, /can_manage_assessments/);
});

test("学生选择支持按姓名或账号搜索，供发布和追加学生复用", async () => {
  const [picker, workspace] = await Promise.all([
    read("src/features/curriculum-plans/components/StudentPicker.tsx"),
    read("src/features/curriculum-plans/components/CurriculumPlanWorkspace.tsx"),
  ]);
  assert.match(picker, /"use client"/);
  assert.match(picker, /type="search"/);
  assert.match(picker, /checked=\{selectedIds\.has\(student\.id\)\}/, "勾选状态必须由 state 控制，避免搜索过滤后卸载勾选框丢失选中");
  assert.match(workspace, /import { StudentPicker } from "\.\/StudentPicker"/);
  assert.match(workspace, /addStudentsToInstitutionPlanAction\.bind\(null, space, appSlug, plan\.id\)/);
  assert.match(workspace, /duplicateCurriculumTemplateAction\.bind\(null, space, appSlug, template\.id\)/);
});
