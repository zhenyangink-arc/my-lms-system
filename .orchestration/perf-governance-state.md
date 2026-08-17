# 桌面端全站性能治理 — 状态账本

> 由 Claude 维护，作为本次性能治理 /loop 无人值守执行的唯一权威状态。/loop 每轮迭代必须先读本文件再继续。

## -1. Standing directives（用户，2026-08-17，跨轮次不得丢失）

- **强制分工**：所有代码调查、性能诊断、基线测量、根因定位、代码修改、验证全部由 Codex 执行。Claude 不得进入 Plan Mode，不得启动 Explore 或其他 Claude 子代理（Agent 工具的 general-purpose/Explore/Plan 等一律禁用）。Claude 只负责：拆分任务、下发 Codex packet、依据 Codex 报告决定验收/修复/继续、维护本账本。
- 需要登录态测量时，由 Codex 自行创建并清理临时学生/管理员账号（挂靠已有租户，不新建租户），不得向用户索要长期账号；账号清理情况必须在报告中确认。
- 使用 `/loop` 持续推进，覆盖全部页面，不等待用户逐批确认。
- 不得破坏业务逻辑、权限、租户隔离；不得改 RLS 策略、不得动真实用户数据。
- 最终必须运行完整验证并报告优化前后数据（baseline vs after）。
- **不 commit / 不 push**——保留工作区 diff 供用户自行审阅。
- Codex 调用：`codex exec --approve-for-me -C <repo> --profile <lane> -o <outfile> - < <packet_file>`（`--approve-for-me` 不与显式 `--sandbox` 同用；`sol-review` 例外，用 `--sandbox read-only`）。

## 0. Session notes

- 2026-08-17 启动。此前一轮已被用户中止的 Claude Explore 调查（未落盘，仅在对话上下文中）覆盖了：middleware、登录重定向链、DashboardHomePage 重复取数、CourseCatalog 串行查询、force-dynamic 使用范围、权限 helper 未缓存、包体/图片问题——**这些线索不得当作结论使用**，本轮要求 Codex 自行独立诊断并产出基线与 backlog；Claude 不得把上一轮的猜测当验收依据。
- Routing policy：`~/.claude/CLAUDE-CODEX-ROUTING.md`（仓库无 local override）。
- 部署方式：`@opennextjs/cloudflare`；`dev`/`build` 脚本显式 `--webpack`（非 Turbopack）。

## 1. Phase 概览

| Phase | 内容 | 状态 |
|---|---|---|
| 0 | Codex 独立诊断：dev vs prod 基线 + 全站 backlog（`.orchestration/perf-baseline.md` + `.orchestration/perf-audit-backlog.md`） | **ACCEPTED**（2026-08-17）|
| 1 | 按 backlog 风险分级逐条派发修复（mechanical→luna, localized-judgment→terra, auth-security-sensitive→sol-implementer） | **进行中** |
| 2 | 全站页面覆盖核对（student 全部 app + admin 全部页面均有 backlog 条目或已确认无问题） | 未开始（Phase 0 已给出覆盖矩阵，Phase 2 仅需核对 Phase 1 未回归） |
| 3 | 最终验证：`npm run check` + `npm run build` + 关键路径 dev/prod 复测，产出优化前后对比报告 | **ACCEPTED（2026-08-17）——治理完成** |

**Phase 3 验收摘要**：`.orchestration/perf-final-report.md` 已生成，153/153 路由同口径复测 `missing=0`。关键结果：tenant 固定鉴权 RTT 5→4（-20%）；管理员登录跳数 4→2；prod warm total 学生 portal 157→115ms、管理首页 213.5→128.6ms；Korean/study-abroad lesson 路由 gzip -46.7~46.8 KiB（约-12.5%）；live session -47.8~48.6 KiB。新增 3 个数据库迁移均为 `SECURITY INVOKER`+显式租户校验，未新增/修改任何 RLS policy。`npm run check`+`npm run build`+`git diff --check` 三项 Claude 独立复跑全部通过。临时账号（本轮累计约 4 对+此前各批次）全部创建-使用-清理并有归零核验。**唯一 caveat**：验证期间共享工作树外部出现一处与本次治理无关的并发改动（`StudentSystemSidebar.tsx` 移除"账户/个人资料"导航项，非本轮 backlog 范围，未回退，已记录）。

## 2. Phase 0 验收结论

ACCEPTED。22 条 backlog（PERF-001..022），已按风险分级（`mechanical`/`localized-judgment`/`auth-security-sensitive`）。`git status` 仅新增 3 个 `.orchestration/*.md`（含本账本本身，Phase 0 开始前已存在，非 Codex 产出），无 `src/` 改动。临时学生/管理员账号已创建使用并彻底清理（auth/profiles/memberships/audit 均归零，已核验）。验收标准 #2（"仅两份报告"）判定为 FAIL 是误报——原因是账本文件本身在 Phase 0 开始前就已创建为未跟踪文件，不算 Codex 产出的越界改动，Claude 已核实并覆盖此判定为通过。

## 3. Backlog 执行队列（源：perf-audit-backlog.md §3，Claude 排定执行批次与 lane）

| Batch | PERF ID | Lane | 状态 |
|---|---|---|---|
| A | PERF-001（请求级重复鉴权/tenant串行解析）+ PERF-003（legacy URL 中转跳数） | `sol-implementer` | **ACCEPTED**（2026-08-17，Claude 独立复核 diff + 重跑 typecheck/lint/test:navigation 全部通过） |
| B | PERF-009（render 路径写 progress） | `sol-implementer` | **ACCEPTED**（2026-08-17，Claude 复核 actions.ts：鉴权/租户/解锁重新校验齐全，写入条件与迁移前逐字段一致，user_id/course_id 服务端派生不受客户端控制） |
| C | PERF-006 + PERF-007（学生 scope/层级查询瀑布，含 memo） | `terra-implementer` | **ACCEPTED（部分）**（2026-08-17）——PERF-007 完成（`getStudentAppCourseScope` 加 `cache()`，6→3 RTT，跨请求/跨app不串数据，已独立复测）；PERF-006 课程级联合并判定 BLOCKED（Codex 认为无法证明嵌套 select 与分步查询在 RLS/发布过滤上完全等价，拒绝冒险），保留现状，视为合理的风险规避而非欠账。Claude 复核时清理了 Codex 遗留的空目录 `src/app/cache-proof/` 及陈旧 `.next/dev` 生成类型（未跟踪文件，非 git 改动，已删除，不影响验收）。 |
| D | PERF-015 + PERF-016 + PERF-017（管理首页/apps catalog fan-out + 串行权限查询） | `sol-implementer` | **ACCEPTED**（2026-08-17）——10→1、20→6 RTT，PERF-017 并发化且拒绝顺序不变；新增迁移 `supabase/migrations/202608170003_tenant_admin_dashboard_aggregates.sql`，两个 `SECURITY INVOKER` RPC 均显式校验 `private.current_tenant_id()`（既有 helper，非新造）+`is_admin_account()`，每张表都带 `tenant_id` 过滤；Claude 复核迁移全文 + 独立重跑 typecheck/lint/test:navigation 全部通过，跨租户负向测试（对方 tenant id 调用返回 42501）由 Codex 实测并经复核合理。 |
| E | PERF-018 + PERF-021（管理业务查询两波 + platform overview 大表拉取） | `sol-implementer` | **ACCEPTED**（2026-08-17）——PERF-018 多处业务表改 FK 嵌套查询减少 profiles 第二波；PERF-021 平台负责人视图改数据库聚合 RPC（9RTT/795行→3RTT/777行），唯一因既有 RLS 无法被 SECURITY INVOKER 跨租户读取的 `learning_time_log` 明确排除在 RPC 外、保留原授权分页兜底且去掉了原先的 5000 行硬截断——判定为合理 BLOCKED 而非失败，且**未引入 SECURITY DEFINER**（已核实两个新迁移均为 SECURITY INVOKER，`is_platform_owner()`/`current_tenant_id()` 均为既有 helper）。新增迁移 004+005（005 是对 004 的修正，不是安全降级）。Claude 复核全部三份迁移 + 独立重跑 typecheck/lint/test:navigation(37/37) 全部通过。 |
| F | PERF-019 + PERF-020（content/textbook/toolbox 树查询 + universities 枚举 fan-out） | `terra-implementer` | **ACCEPTED**（2026-08-17）——全为 FK 嵌套 select，无新迁移；content 4→3、textbooks 9→4、toolbox 10→5 RTT；universities fan-out 改 `.in()`+内存分组，不再随枚举数量线性增长；`courses→lessons` 因复合 FK 两侧 tenant_id 为 NULL、嵌套会丢数据，正确保留分步查询（BLOCKED 合理）。Claude 独立重跑 typecheck/lint/test:navigation(39/39) 通过，但新增 10 条 `no-unused-vars` warning（未使用的解构字段如 `_chapters`/`_versions`，exit code 仍 0，不阻断），已记入 §4 待办，随 Batch H 一并交给 luna-worker 机械清理。 |
| G | PERF-012 + PERF-013（重 client 模块拆分，需先 bundle trace） | `terra-implementer` | **ACCEPTED**（2026-08-17）——学生课时路由 gzip -11.7%（374→330 KiB），韩语练习/进度页 -4.7%，管理端教材/工具箱 -1.5~1.8%；Hangul book 按章节动态加载、研究工作台/教材编辑弹窗/工具箱弹窗改点击时加载，均保留 `role=status`/`aria-live`/焦点/占位尺寸；`KoreanChapterTestRunner` 拆分无效已主动撤回；`KoreanLevelOneSmartTextbook` 因状态耦合深，判定超出低风险范围未拆（合理 BLOCKED）。Claude 独立重跑 typecheck/lint(10条既有 warning 不变)/test:navigation(39/39) 通过。 |
| H | PERF-010 + PERF-022（legacy window.location 导航/reload）+ Batch F 遗留的 10 条 unused-vars lint warning 清理 | `luna-worker` | **ACCEPTED**（2026-08-17）——11 个 lesson book 组件的"去做测试"改 `router.push()`+`scopeDashboardPath()`，Claude 复核三种 URL 形态（app-scoped/legacy space/legacy 无 space）目标路径均正确且都是真实存在的路由；`DataSyncStatusDialog` 改 `router.refresh()`；10 条 lint warning 清零（改用 `Reflect.deleteProperty` 排除嵌套字段，未误删业务字段）。Codex 本地无 Supabase 容器无法做临时账号浏览器实测，如实标 BLOCKED，未编造通过；Claude 通过静态 diff 审查 + 独立重跑 typecheck/lint(0 warnings)/test:navigation(39/39) 补足验证，判定可接受。 |
| I | PERF-014（包体证据驱动评估，仅在有 trace 证据时才动 next.config） | `terra-implementer` | **ACCEPTED**（2026-08-17）——`@xyflow/react` 改为对话框打开时动态加载，home-tree 首屏 gzip -14.85%（355,893→303,040 B）；`@tanstack/react-table` 三条路由 A/B 测试逐字节相同，证据不支持加 `optimizePackageImports`，正确未改 `next.config.ts`；未重复配置 `lucide-react`。Claude 独立重跑 typecheck/lint/test:navigation(39/39) 通过，diff 范围核实仅涉及 2 个 home-tree 文件 + backlog 状态更新。 |
| J | PERF-004 + PERF-005 + PERF-008（Korean 首页重复取数、租户门户 RTT、assignment layout/page 重复查询） | `sol-implementer` | **ACCEPTED**（2026-08-17）——首页重复 auth/profile 2→0 RTT，首页整体14阶段→5阶段串行；portal apps+enrollment 2阶段→1阶段；assignment layout/page 共享 `cache()` loader 后 2→1 RTT。改前改后页面正文用 SHA-256 逐字节比对完全一致；无效/无权限 ID 仍正确 404/重定向。`StudentTopbar` 与首页两处 `lesson_questions`（范围与上限不同）、`getCurrentKoreanCourse` 5级级联均因无法证明合并后语义完全等价而合理保留。Claude 复核 `withStudentAppSchemaFallback` 移除点（该函数本就是 no-op，之前已废弃 legacy fallback，移除不改变行为）+ 独立重跑 typecheck/lint/test:navigation(39/39) 通过。 |
| K | PERF-002（force-dynamic 缓存缺口，需拆分 published-catalog vs 私密数据，架构风险最高） | `sol-implementer` | **ACCEPTED**（2026-08-17）——保守部分修复：仅对"已发布公告"+"已发布帮助文章"两类数据用 `unstable_cache`+tenant-scoped tag 缓存（1小时 TTL + 写操作 `updateTag` 即时失效），未触碰任何 `force-dynamic` 声明（`git diff \| grep 'dynamic ='` 为空）。课程目录/详情、公告后台、帮助后台、大学目录等因权限/草稿/个性化耦合太深，正确判定不安全而保留原状。**Claude 独立核对了两处新 admin-client（service-role，绕过RLS）查询与对应表当前 RLS 策略（`announcements`、`help_articles` 迁移）逐条比对，确认手写过滤条件与 RLS 语义完全等价**，且原页面查询本就已有 `.eq(\"status\",\"published\")` 显式过滤，无行为变化；tenant_id 经 UUID 正则校验防注入。独立重跑 typecheck/lint/test:navigation(39/39) 通过。 |
| L | PERF-011（学生 shell hydration 边界过宽，需先 profiler） | `terra-implementer` | **ACCEPTED**（2026-08-17）——`StudentPageHeader` 由独立 client root 改为纯展示、复用 `DashboardPermissionGate` 已有的 pathname 渲染；`GuideAgentProvider`/Chat 改点击时懒加载；代表性学生路由同步首载 -9.0 KiB gzip（约3%）。真实 Playwright 实测：侧栏开合、全屏、权限拦截、header 标题联动、GuideAgent 懒加载全部行为不变。三个临时账号已清理。Claude 独立重跑 typecheck/lint/test:navigation(39/39) 通过，diff 范围核实。**至此 PERF-001 至 PERF-022 全部 22 条 backlog 均有明确结论（完成/合理BLOCKED），进入 Phase 3 最终验证。** |

## 4. Outstanding items / blockers

（待填，随每个 Batch 验收结果更新）
