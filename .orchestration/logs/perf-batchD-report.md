已完成 PERF-015/016/017，并已将聚合 RPC 迁移应用到已链接数据库。未 commit/push，未修改其他 backlog 条目或 RLS。

### 改动文件

- [管理首页](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/page-content.tsx:161)：10 项租户统计合并为 1 个 RPC，并与 access helpers 同批并发。
- [应用目录](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/apps/ManagementApplicationCatalogPage.tsx:125)：学生、业务、员工指标由 `3*N` 合并为 1 个 tenant RPC；平台共享课程保留逐 app count。
- [应用权限](/home/yangzhen/projects/my-lms-system/src/lib/management-apps.ts:310)：两个独立权限查询改为 `Promise.all`。
- [聚合 RPC 迁移](/home/yangzhen/projects/my-lms-system/supabase/migrations/202608170003_tenant_admin_dashboard_aggregates.sql:1)：两个 `SECURITY INVOKER` RPC；校验当前租户和管理员身份，每张租户表均显式过滤 `tenant_id`。

### 验收结果

1. **PASS** — `npm run typecheck && npm run lint && npm run test:navigation`

   - exit 0
   - navigation：35/35 通过
   - 仅有现存 `MODULE_TYPELESS_PACKAGE_JSON` 警告

2. **PASS** — `npm run build`

   - Next.js 16.2.10
   - 编译、TypeScript、18 个静态页面生成、trace 收集全部成功
   - exit 0

3. **PASS** — `yuanzhi` 临时管理员实测

   - 管理首页旧查询/新 RPC：10 个字段完全一致
   - 页面显示：机构成员 19、已发布任务 0、已发布公告 0、待处理 0
   - apps 旧/新指标完全一致：
     - 韩语：课程 5、学生 13、业务 0、员工 5
     - 英语/数学/大学：课程 0、学生 13、业务 0、员工 5
     - 留学：课程 8、学生 13、业务 1、员工 5
   - 页面汇总：运行中 2、授权学生 65 人次、应用内业务 1 项

4. **PASS** — 跨租户隔离

   - 使用第二租户 `yuanyuan` ID 负向调用两个 RPC。
   - 两次均返回 PostgreSQL `42501`。
   - RPC 为 `SECURITY INVOKER`，继续应用原 RLS；入口要求参数 tenant 等于 `private.current_tenant_id()`，底层所有租户表再次显式过滤 tenant。

5. **PASS** — 往返下降

   - PERF-015 租户统计：`10 → 1`，下降 90%；且从 access 后第二波改为与 access 同批。
   - PERF-016，5 个可见 app：`20 → 6`，下降 70%。
   - PERF-017：两个串行 RTT 改为同一并发波；错误检查顺序保持 tenant error → tenant not found → staff error → deny。
   - 平台共享课程缺少等价 tenant 过滤，因此保留 `N` 个 count。
   - 无 tenant 的平台全局分支也保留原查询，避免为追求合并而扩大跨租户统计范围。

6. **PASS** — 临时账号清理

   - 创建/删除账号 UUID：`3ba03c6f-b205-4d8e-856b-0e955e2d84cb`
   - 清理后反查：profile 0、membership 0、staff assignment 0、enrollment 0、membership audit 0、Auth user 不存在。

7. **PASS** — 工作树范围

   - 本 packet 只新增/修改上述 4 个文件。
   - Phase 0 已存在的其他脏文件保持不动。
   - 针对三个已跟踪改动运行 `git diff --check`，通过。
   - 未修改 backlog，未 commit/push。

迁移状态也已复查：`202608170003` 本地与远端一致。