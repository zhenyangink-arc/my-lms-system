# PUFFY LMS 多租户 SaaS 数据库架构

## 1. 目标与边界

项目采用“共享 PostgreSQL 数据库、共享表”的多租户模式。每一条租户业务数据都带有不可为空的 `tenant_id`，数据库用行级安全（RLS）验证租户成员关系，应用层只负责选择当前租户与改善查询性能，不能充当唯一安全边界。

当前迁移采用渐进式方案：先建立租户控制面并把现有用户纳入默认租户，再按业务模块给表补齐 `tenant_id`、复合外键、索引和租户策略。迁移期间不复制数据库、不按租户建 schema，也不从域名、请求参数或可由用户修改的 `user_metadata` 直接推导权限。

## 2. 核心模型

```text
auth.users / profiles（全局用户身份）
        │
        └── tenant_memberships（租户内角色、状态、会员档位、默认租户）
                    │
                    └── tenants（租户、套餐、状态、配置）

tenants.id
   ├── courses.tenant_id
   ├── announcements.tenant_id
   ├── learning_assignments.tenant_id
   ├── library_resources.tenant_id
   ├── help_tickets.tenant_id
   └── student_* / grade_* / audit_*.tenant_id
```

关键决策：

- `profiles` 是用户全局身份，不直接归属某一个租户。同一个 Auth 用户可以加入多个租户。
- `tenant_memberships` 是租户授权的唯一事实来源；`profiles.role/status/membership_tier` 仅在过渡期保留，最终由成员关系替代。
- `tenant_id` 既用于 RLS，也必须出现在索引、唯一约束和父子表复合外键中。
- 默认租户只是当前选择器。任何从客户端传入的租户 ID 都必须再次通过成员关系校验。
- 平台管理员与租户管理员是两种互斥权限。平台最高角色为 `platform_super_admin`，租户最高角色为 `tenant_super_admin`；租户负责人不能自动修改全平台共享目录。

身份分层：

- `profiles.global_role` 只决定 URL 空间：`platform_owner` / `platform_deputy` 进入 `/platform/dashboard`，其余身份进入 `/t/{tenantSlug}/dashboard`。
- `profiles.role` 保存账号级角色镜像；平台负责人使用 `platform_super_admin`，机构负责人使用 `tenant_super_admin`，不再共用 `super_admin`。
- `tenant_memberships.role` 是租户业务授权事实来源，最高角色只能是 `tenant_super_admin`，不能出现平台角色。

## 3. 数据归属分类

### 3.1 全局身份表

- `auth.users`
- `profiles`

这两张表不增加 `tenant_id`。管理端读取其他用户资料时，必须通过 `tenant_memberships` 限制为当前租户成员。

### 3.2 平台共享目录

- `korean_universities`
- `korean_university_programs`
- `schools`
- `school_programs`
- `university_application_document_requirements`
- `university_visa_application_requirements`

这些数据当前是平台维护的韩国院校与申请模板，先保持全局共享。未来若租户需要自定义，应新建带 `tenant_id` 的覆盖表，例如 `tenant_university_overrides`，不要直接复制 7,000 余条模板到每个租户。

### 3.3 租户内容与授权

- 课程：`course_categories`、`courses`、`lessons`、`lesson_resources`
- 公告：`announcements`、`announcement_admin_assignments`
- 作业考试：`learning_assignments` 及其 questions、keys、targets、submissions、answers
- 对话练习：`conversation_practice_scenarios`、progress、admin assignments
- 帮助中心：`help_articles`、tickets、messages、admin assignments
- 成绩与记录：`grade_*`、`learning_record_*`
- 资料库：`library_*`

上述表需要直接增加 `tenant_id`。模块管理员授权表的主键从 `admin_id` 改为 `(tenant_id, admin_id)`，这样同一个管理员可在多个租户拥有不同模块权限。

### 3.4 租户内用户数据

- `lesson_progress`、`lesson_questions`
- `student_university_targets`、comparisons、assessments
- `student_application_documents`、files、events
- `student_visa_cases`、tasks、events
- `ai_token_usage`

这些表即使已有 `user_id` 也必须增加 `tenant_id`。只按用户隔离无法支持同一用户在不同租户拥有两份独立学习记录。

### 3.5 审计与删除日志

- `account_management_audit_logs`
- `account_deletion_audit_logs`
- `course_content_audit_logs`
- `student_service_card_deletion_logs`

审计记录也必须保存 `tenant_id`，并在删除业务对象或成员后继续保留租户上下文。`actor_id` 可以因用户删除而置空，但 `tenant_id` 和快照字段不能丢失。

## 4. 表约束标准

每张租户业务表统一采用以下结构：

```sql
tenant_id uuid not null references public.tenants(id) on delete restrict
```

父表增加租户复合候选键，子表使用复合外键，防止写入跨租户关系：

```sql
alter table public.courses
  add constraint courses_tenant_id_id_key unique (tenant_id, id);

alter table public.lessons
  add constraint lessons_tenant_course_fkey
  foreign key (tenant_id, course_id)
  references public.courses (tenant_id, id)
  on delete cascade;
```

仅有 `course_id -> courses(id)` 的普通外键不能证明子行与父行属于同一租户，因此不能作为最终状态。

租户内自然键必须把 `tenant_id` 放在最前面：

```sql
unique (tenant_id, slug)
unique (tenant_id, user_id, task_key)
unique (tenant_id, assignment_id, student_id)
```

常用索引也遵循同一顺序：

```sql
create index on public.help_tickets (tenant_id, status, created_at desc);
create index on public.lesson_progress (tenant_id, user_id, updated_at desc);
```

## 5. RLS 标准

租户隔离函数放在未暴露给 Data API 的 `private` schema，并使用固定的空 `search_path`。策略中的无行参数函数用 `select` 包裹，让 PostgreSQL 每条语句只计算一次。

普通成员读取示例：

```sql
create policy "tenant members read published courses"
on public.courses
for select
to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (is_published or (select private.has_current_tenant_role(
    array['admin', 'ceo', 'tenant_super_admin']::text[]
  )))
);
```

写入必须同时使用 `using` 与 `with check`，避免通过更新 `tenant_id` 把一行移动到其他租户：

```sql
create policy "tenant admins manage courses"
on public.courses
for all
to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select private.has_current_tenant_role(
    array['admin', 'ceo', 'tenant_super_admin']::text[]
  ))
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select private.has_current_tenant_role(
    array['admin', 'ceo', 'tenant_super_admin']::text[]
  ))
);
```

所有 `security definer` RPC、触发器和 Route Handler 都需要重新审计。RLS 不能保护由表所有者执行且未自行校验租户的安全定义者函数。

## 6. 当前租户解析

第一阶段用 `tenant_memberships.is_default` 保存当前租户，`public.set_default_tenant()` 原子切换。其优点是无需相信 Cookie 或 JWT 中的租户 ID，切换后立即生效；限制是同一用户多个浏览器标签页共享一个默认租户。

应用层应在服务端认证上下文中返回：

```ts
type TenantContext = {
  id: string;
  slug: string;
  name: string;
  status: string;
  planKey: string;
  role: "student" | "teacher" | "admin" | "ceo" | "tenant_super_admin";
  membershipTier: "normal" | "vip1" | "vip2" | "vip3";
};
```

页面查询仍应显式 `.eq("tenant_id", tenantId)`，用于减少扫描和防止多租户数据在 UI 中混合；数据库 RLS 是第二道且不可省略的安全边界。

## 7. 文件存储

新上传对象统一使用租户前缀：

```text
{tenant_id}/{user_id}/{resource_kind}/{uuid}.{ext}
```

现有路径兼容读取，但所有新路径必须包含租户 ID。Supabase Storage 策略应校验路径第一段等于当前租户；R2 下载 Route Handler 必须先通过带 RLS 的元数据表读取对象键，再生成短期签名 URL，不能接受客户端直接提交对象键进行签名。

## 8. 分阶段迁移

### 阶段 A：租户控制面

由 `202607200002_multi_tenant_foundation.sql` 完成：

1. 创建 `tenants`、`tenant_memberships` 和成员审计表。
2. 创建私有 RLS 辅助函数与默认租户切换 RPC。
3. 创建固定 ID 的 `puffy` 默认租户。
4. 按现有 `profiles.role/status/membership_tier` 回填所有用户。
5. 新注册 profile 自动加入兼容租户，避免产生无租户账号。
6. 账号管理对 `profiles` 的角色、状态和会员变更同步到兼容租户成员关系。
7. `src/lib/auth.ts` 暴露当前租户上下文，但过渡期仍用 `profiles` 字段执行原有角色判断。
8. 不改变任何现有业务表，部署后业务行为保持不变。

### 阶段 B：业务数据隔离（已完成）

由 2026-07-21 的三个迁移一次性完成，未按模块拆分：

1. `202607210001_tenant_id_on_business_tables.sql`：43 张业务表增加 `not null tenant_id`
   并按「行归属用户默认租户 → 父表 → PUFFY 兜底」回填；父子表复合外键
   `(tenant_id, id)`；`slug`、`(user_id, task_key)` 等租户内自然键补入 `tenant_id`；
   模块管理员授权表主键改为 `(tenant_id, admin_id)`；统一 `private.enforce_tenant_scope()`
   触发器：插入自动落当前租户（服务端写入按归属用户推导，推导不出则报错），
   禁止跨租户改行。
2. `202607210002_tenant_scoped_rls.sql`：`current_profile_role()/current_profile_status()/`
   `student_feature_allowed()` 及全部模块权限函数改读 `tenant_memberships`；
   业务表全部策略重建并带 `tenant_id = (select private.current_tenant_id())`；
   `profiles` 管理端读写限定同租户成员；平台共享目录（院校/学校/申请与签证要求模板）
   保持全局读、写入收紧为 `private.is_platform_catalog_manager()`（PUFFY 管理层或平台负责人）。
3. `202607210003_tenant_scoped_rpcs_and_lifecycle.sql`：全部按 id 读写业务行的
   SECURITY DEFINER RPC 增加租户守卫；`list_*_students` 改按当前租户成员枚举；
   授权触发器校验被授权人是本租户活跃管理员；`delete_managed_account` 只能删除
   仅属于本租户的成员；账号管理同步触发器改同步到成员默认租户；
   `delete_tenant_permanently` 先清空该租户业务数据。
4. `202607210004_split_platform_and_tenant_super_admin.sql`：将历史 `super_admin`
   数据拆成 `platform_super_admin` 与 `tenant_super_admin`；重建角色约束、平台权限
   函数、账号同步触发器，并统一改写现存函数与 RLS 中的历史角色字面量；平台账号
   会清除租户成员关系，机构开通账号只保留其归属租户。
5. `202607210005_static_tenant_permanent_deletion.sql`：将永久删除租户 RPC 的动态
   表名循环展开为按外键顺序排列的显式删除语句，使数据库 lint 能验证全部目标表。

应用层同步调整：模块授权 upsert 的 `onConflict` 改为 `tenant_id,admin_id`。
已用双租户账号在 SQL 层通过越权用例（读隔离、按 UUID 写 0 行、RPC 拒绝、
禁止改 tenant_id、写入自动落本租户）。

过渡期注意：`profiles.role/status/membership_tier` 仍作为镜像字段保留，
由账号管理页写入并经触发器同步到成员默认租户的成员关系；数据库权限
已不再依赖它们（阶段 C 收尾时移除）。

### 阶段 C：角色事实来源切换（剩余工作）

1. ~~所有权限函数从 `tenant_memberships` 读取角色~~（阶段 B 已完成）。
2. 账号管理动作改写成员关系，不再改 `profiles.role/status/membership_tier`
   （当前经同步触发器过渡，仅对成员的默认租户生效）。
3. 触发器中残留的 `profiles.role` 内联检查逐个换成 `current_profile_role()`。
4. 稳定一个发布周期后，将 `profiles` 中三个旧字段标记废弃并最终删除。

### 阶段 D：待办事项

1. **非 PUFFY 租户的学生开通**：自助注册仍固定加入 PUFFY 兼容租户；
   第二租户需要邀请注册或管理员代建账号流程才能收学生。
2. Storage/R2 对象路径加 `{tenant_id}/` 前缀与路径校验（见第 7 节）。
3. 服务端查询逐步补显式 `.eq("tenant_id", ...)`（RLS 已兜底，此项是性能与防御纵深）。
4. Edge Function 写 `ai_token_usage` 依赖触发器按 `user_id` 推导租户；
   后续应改为显式传 `tenant_id`。

## 9. 上线门槛

在创建第二个真实租户前，必须满足：

- 所有租户业务表的 `tenant_id` 已 `not null`。
- 所有父子关系已有 `(tenant_id, id)` 复合外键。
- 所有唯一约束包含 `tenant_id`。
- 所有 RLS、RPC、触发器、Storage/R2 路径都经过跨租户测试。
- 服务端查询显式携带当前 `tenant_id`。
- 后台任务和 `service_role` 写入显式传入 `tenant_id`，且有审计记录。
- 监控按 `tenant_id` 统计错误率、慢查询、存储用量与 AI Token 用量。
- 已演练单租户导出、封禁、恢复与数据删除。

## 10. 必测越权场景

至少准备租户 A、租户 B 各一个学生与管理员，并验证：

- A 学生无法按已知 UUID 读取、更新或删除 B 的数据。
- A 管理员无法管理 B 的学生、课程、文件和审计记录。
- 把 A 子表行关联到 B 父表时，复合外键拒绝写入。
- 修改请求体中的 `tenant_id` 不会越权。
- 切换默认租户后，旧租户数据立即不可见。
- 被 suspended/left 的成员无法继续访问历史数据。
- `service_role` 后台任务缺失 `tenant_id` 时失败，而不是落入默认租户。
