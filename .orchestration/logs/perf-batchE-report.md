已完成 PERF-018，并完成 PERF-021 的安全聚合主路径；未改权限结果、RLS、租户或真实业务数据，未 git commit/push。

### 改动文件

- [accounts service](/home/yangzhen/projects/my-lms-system/src/features/accounts/api/service.ts:93)：membership/profile、审计 actor 改为 FK 嵌套查询。
- [announcements service](/home/yangzhen/projects/my-lms-system/src/features/announcements/api/service.ts:30)：发布人 profile 并入 announcement 查询。
- [grades service](/home/yangzhen/projects/my-lms-system/src/features/grades/api/service.ts:152)：submission、attempt、review 分别嵌套 student profile。
- [application people](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/apps/ManagementApplicationPeoplePage.tsx:71)：membership/profile 合为一次查询。
- [conversation overview](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/conversation-practice/page-content.tsx:279) 与 [detail](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/conversation-practice/[scenarioId]/page-content.tsx:35)：progress/student 合并。
- [platform overview](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/apps/ManagementPlatformApplicationOverviewPage.tsx:101)：平台负责人使用聚合 RPC；不具备 invoker 跨租户权限的兼容路径改为稳定分页，无 5000 截断。
- [migration 004](/home/yangzhen/projects/my-lms-system/supabase/migrations/202608170004_platform_management_app_overview.sql:1)、[migration 005](/home/yangzhen/projects/my-lms-system/supabase/migrations/202608170005_platform_management_app_overview_invoker_fix.sql:9)：最终 RPC 为 `SECURITY INVOKER`，逐表关联活跃 `tenant_id`，仅授权 authenticated。
- [regression test](/home/yangzhen/projects/my-lms-system/tests/admin-query-consolidation.test.mjs:1)：锁定 FK 嵌套、Invoker 权限和无硬截断契约。

### 验收结果

| # | 结果 | 证据 |
|---|---|---|
| 1 | PASS | `typecheck`、`lint` 均 exit 0；`test:navigation` 37/37 通过。 |
| 2 | PASS | `npm run build`：Next 16.2.10 编译、TypeScript、18/18 静态页及 build traces 全部成功。 |
| 3 | PASS | 真实生产页面 HTTP 200。Accounts：`17/17/17` 完全一致；Grades：`[20,0,3,0]` 完全一致；Platform records：覆盖机构 2、学生 14、员工 6、任务 0、学习 330.7 小时完全一致。 |
| 4 | PASS | `yuanzhi` 管理员调用跨机构 RPC 返回 PostgreSQL `42501`；指定第二租户 `08eb090c-…` 查询可见行数为 0。 |
| 5 | PASS；学习时长 RPC 子项 BLOCKED | PERF-018 各目标减少 1 次 profile RTT。Platform owner 当前数据从 9 RTT/2 波/795 行降至 3 RTT/1 波/777 行；现有 773 行恰为学习时长明细。原 45,000 行上限场景约降至最多 5,004 行，约 88.9%。 |
| 6 | PASS | 三轮证据采集共 6 个临时账号均删除；`profiles`、membership、provisioned、staff profile 及三类审计表全部计数 0；Auth 均为 not found。 |
| 7 | PASS | 本任务差集仅上述 10 个相关文件。完整工作树仍含开始前已存在的 Batch D、lesson、routing 等共享改动，未触碰或回退。`git diff --check` 通过。 |

### PERF-021 安全边界

`learning_time_log` 创建晚于平台负责人 RLS 旁路迁移，真实测试证明 `SECURITY INVOKER` 无法跨租户读取：旧值 330.7 小时、初版 invoker 结果为 0。按要求未修改 RLS、也未引入 `SECURITY DEFINER`。

因此最终方案是：

- 其余 8 张业务表在数据库端聚合，只返回 2 个租户结果。
- `learning_time_log` 保留服务端显式授权查询，但使用稳定分页拉全量，不再静默截断。
- 平台副负责人继续走完整分页兼容路径，避免扩大其数据库直连权限。

远端验证：

- 迁移 `202608170004`、`202608170005` 均已应用。
- `security_definer=false`。
- `public_execute=false`、`anon_execute=false`、`authenticated_execute=true`。
- DB push 出现非阻断的 pg-delta catalog 缓存证书警告；独立查询已确认迁移和最终函数签名生效。

### 保留原两波的位置

- document/visa/model usage：主业务 `user_id` 没有到 profiles 的 FK。
- tenant-management/help：刻意混用 RLS client 与 Admin Client；直接嵌套会改变平台副负责人或非 executive handler 的可见范围。

这些位置未为减少 RTT 而绕过原有租户、状态或权限条件。