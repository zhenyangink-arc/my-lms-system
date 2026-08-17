# 桌面端全站性能治理最终报告

日期：2026-08-17（Asia/Seoul）
栈：Next.js 16.2.10、webpack、Supabase SSR、`@opennextjs/cloudflare`
比较基线：`.orchestration/perf-baseline.md`（Phase 0）

## 1. 结论与验收

本轮 PERF-001 至 PERF-022 均已有最终结论：能够在既有权限、RLS 和租户隔离边界内证明等价的部分已完成；不能证明等价或需要扩大架构/安全范围的部分明确保留为合理 BLOCKED。收尾阶段没有修改任何 backlog 功能代码，也没有 commit/push。

| # | 验收项 | 状态 | 证据 |
|---:|---|---|---|
| 1 | 完整验证 | **PASS** | `npm run check` exit 0：navigation 39/39、typecheck exit 0、lint exit 0；`npm run build` exit 0：compile 13.3s、TypeScript 39.2s、18/18 static pages；`git diff --check` exit 0。 |
| 2 | 最终报告 | **PASS** | 本文件已生成，含 22 条状态、dev/prod 计时、登录链、固定鉴权 RTT、153 路由 JS 对比、迁移安全边界、BLOCKED 与风险。 |
| 3 | 临时账号清理 | **PASS** | 所有测量/重试账号均执行 `auth.admin.deleteUser`；每轮最终 `profiles`、`tenant_memberships`、`student_app_enrollments`、`tenant_provisioned_accounts`、`staff_profiles`、两类 audit 均为 0，Auth 反查均 not found。 |
| 4 | 收尾改动范围 | **BLOCKED（共享工作树并发变化）** | 本代理相对收尾快照只新增 `.orchestration/perf-final-report.md`；但初始快照中未修改的 `StudentSystemSidebar.tsx` 于 21:52:57 +09:00 在测量期间出现外部修改（移除账户/个人资料导航组）。该文件不是本代理改动，也不是验证发现的回归；为保护并发用户工作未回退。因此完整工作树无法满足“仅报告”的字面条件。 |

未发现需要在收尾阶段修复的本轮直接回归；因此没有新增功能代码修复。上述并发 `StudentSystemSidebar.tsx` diff 已保留且不计入本代理交付。

## 2. PERF-001 至 PERF-022 最终状态

| ID | 最终状态 | 结论摘要 |
|---|---|---|
| PERF-001 | **DONE（安全保留 1 RTT）** | tenant RSC 解析由 4→3 RTT；middleware `getClaims()` 与 RSC `getUser()` 仍分层验证，避免削弱撤销与服务端鉴权边界。 |
| PERF-002 | **DONE（保守范围）/ BLOCKED（其余目录）** | 仅缓存租户已发布公告和帮助文章，并按 tenant tag 精确失效；课程、后台草稿、大学目录等因权限/个性化耦合不做跨请求缓存，所有 `force-dynamic` 保留。 |
| PERF-003 | **DONE** | 登录和站内已知入口改为 canonical scoped URL；legacy 外部入口继续兼容。管理员登录不再经过 `/dashboard` 和 `/yuanzhi/dashboard`。 |
| PERF-004 | **DONE（子项 BLOCKED）** | Korean 首页重复 auth/profile 2→0 RTT，约 14 阶段→5 阶段；Topbar 与首页 question 查询范围/上限不同，拒绝错误共享。 |
| PERF-005 | **DONE（子项 BLOCKED）** | portal apps 与 enrollment 由串行变并发；current-course 五级依赖链因无可证明等价的安全 RPC/关系查询而保留。 |
| PERF-006 | **BLOCKED（风险规避）** | 课程层级联合并无法证明与既有 RLS、published 过滤及解锁语义等价，未改。 |
| PERF-007 | **DONE** | `getStudentAppCourseScope` 加 request-scoped React `cache()`；同 render 重复调用新增 0 RTT，不跨请求/跨 app 共享。 |
| PERF-008 | **DONE** | assignment layout/page 共享 request-cached loader，同一 assignment 表读取 2→1 RTT。 |
| PERF-009 | **DONE** | lesson Server Component render 改为只读；进度写入移到客户端明确事件触发的幂等 Server Action，并重新做鉴权/租户/解锁校验。 |
| PERF-010 | **DONE** | 11 个 lesson book 的测试入口由整页 legacy `window.location.assign` 改为 scoped canonical `router.push`。 |
| PERF-011 | **DONE** | 学生 header 不再是独立 client entry；GuideAgent 首次点击后加载；此前实测交互与权限拦截保持。 |
| PERF-012 | **DONE（部分）/ BLOCKED（深耦合项）** | Hangul book、研究工作台等按需拆分；`KoreanLevelOneSmartTextbook` 状态耦合过深，`KoreanChapterTestRunner` 拆分无收益，未扩大重构。 |
| PERF-013 | **DONE** | 当前实际路由上的教材/工具箱关闭弹窗与重工作区改为交互时加载；旧巨型 manager 不在实际依赖图，不做无效改造。 |
| PERF-014 | **DONE** | React Flow 图预览打开时加载；TanStack A/B 构建无差异，因此未盲加 package import 配置，也未重复配置 lucide。 |
| PERF-015 | **DONE** | tenant 管理首页指标由多次 fan-out 合并为 tenant-safe summary RPC，10 个 access helper 聚合为 1 波。 |
| PERF-016 | **DONE** | 应用目录 per-card 统计改为批量 tenant-safe RPC，避免 `4*N` 扩张。 |
| PERF-017 | **DONE** | tenant app 两个独立权限读取并发化，原错误与 deny 顺序保持。 |
| PERF-018 | **DONE** | 已确认 FK 的业务查询使用嵌套关系，减少普遍存在的 profiles 第二波；未绕开原租户/角色过滤。 |
| PERF-019 | **DONE（部分）/ BLOCKED（复合 FK）** | content 4→3、textbooks 9→4、toolbox 10→5 RTT；`courses→lessons` 因复合 FK 两侧 tenant_id 可为 NULL、嵌套会丢数据，保留分步。 |
| PERF-020 | **DONE** | universities 按枚举循环查询改为 `.in()` 批量读取后内存分组，不再随枚举数线性增长。 |
| PERF-021 | **DONE（聚合）/ BLOCKED（学习时长 RPC）** | platform overview 改 SECURITY INVOKER 聚合 RPC；`learning_time_log` 的既有 RLS 不允许 invoker 跨租户读取，继续使用显式授权、tenant-correlated、无 5000 行截断的分页兜底。 |
| PERF-022 | **DONE** | Data sync 重新检查由 `window.location.reload()` 改为 `router.refresh()`。 |

## 3. 测量口径

- 公开页沿用 `curl -sS -L -o /dev/null -w ...`，每条 3 次，warm average 为 s2+s3。
- 登录态沿用 Playwright Chromium 1440×900、真实 `/login` 表单和 `signInWithPassword` token 请求；同一会话对 canonical 路由整页加载 3 次。TTFB 取 document request timing 的 `responseStart`，total 为 `page.goto(..., waitUntil: "load")` 完成时间。
- prod 计时来自首轮通过验证的 PERF build（`next start -p 3101`）。测量期间共享工作树随后出现外部 `StudentSystemSidebar.tsx` 改动；最终又对包含该并发改动的当前工作树完整重跑 check/build，JS 表也以最终 build 重算。该并发改动不是 PERF 功能改动，prod 路由计时没有为它重跑。
- 仓库在收尾开始前已有 PID 3842606 的 `next dev` 占用 `.next/dev` 锁，Next 拒绝第二个 dev 实例；没有终止该用户进程，dev 使用其 3000 端口。其 s1 可能已预热且存在 dev hot-reload/hydration 波动，不能视为严格冷启动。
- JS 估算严格复用 Phase 0 方法：`rootMainFiles` + 每个 page 的 `page_client-reference-manifest.js` 中 `clientModules[*].chunks`，JS 去重后累计 raw 与逐文件 `gzipSync`。本次枚举 160 个 page manifest；Phase 0 的 153 条目标全部匹配，`missing=0`。

## 4. 改前 vs 改后

### 4.1 登录链、固定鉴权与稳定时间

| 指标 | Phase 0 | 本次 | 变化 |
|---|---:|---:|---:|
| tenant 整页固定鉴权/上下文 RTT | 5（middleware 1 + RSC 4） | 4（middleware 1 + RSC 3） | **-1 / -20%** |
| 学生 app URL 跳数（从 `/login` 到稳定） | 2：`/login/redirect` → `/yuanzhi` | 2：相同 | 0 |
| 管理员 app URL 跳数（从 `/login` 到稳定） | 4：`/login/redirect` → `/dashboard` → `/yuanzhi/dashboard` → final | 2：`/login/redirect` → final | **-2 / -50%** |
| prod 学生提交至稳定 | 3278 ms | 994 ms | -2284 ms / -69.7%（受网络波动影响） |
| prod 管理员提交至稳定 | 2292 ms | 471 ms | -1821 ms / -79.5%（受网络波动影响） |

本次 prod 两个角色都只发出 1 次 Supabase `/auth/v1/token` 请求。观察链为：

- student：`/login` → token → `/login/redirect` → `/yuanzhi`。
- tenant admin：`/login` → token → `/login/redirect` → `/yuanzhi/dashboard/admin`。

### 4.2 公开页 curl

| mode/path | Phase 0 s1 TTFB/total ms | 本次 s1 | Phase 0 warm avg | 本次 warm avg |
|---|---:|---:|---:|---:|
| dev `/` | 115.711 / 116.628 | 1013.637 / 1015.369 | 30.404 / 31.334 | 87.914 / 88.759 |
| dev `/login` | 190.543 / 191.545 | 2389.821 / 2401.947 | 39.987 / 41.083 | 43.493 / 44.557 |
| prod `/` | 74.073 / 74.105 | 73.609 / 73.644 | 3.415 / 3.439 | 3.487 / 3.510 |
| prod `/login` | 6.984 / 7.009 | 7.367 / 7.393 | 2.857 / 2.879 | 3.503 / 3.531 |

所有有效 curl 样本均为最终 HTTP 200、`redirects=0`。dev s1 受既有 dev server 编译/热更新状态影响明显；prod 口径最稳定。

### 4.3 登录态代表路由

| mode/role/path | Phase 0 s1 TTFB/total ms | 本次 s1 | Phase 0 warm avg | 本次 warm avg |
|---|---:|---:|---:|---:|
| dev student `/yuanzhi` | 7472 / 8592 | 163.194 / 1100.190 | 129 / 791 | 227.351 / 952.469 |
| prod student `/yuanzhi` | 12 / 263 | 12.554 / 151.848 | 8.5 / 157 | 10.085 / 115.208 |
| dev admin `/yuanzhi/dashboard/admin` | 2283 / 3223 | 172.085 / 1136.413 | 87.5 / 812.5 | 159.033 / 871.062 |
| prod admin `/yuanzhi/dashboard/admin` | 11 / 186 | 9.296 / 136.994 | 10 / 213.5 | 8.266 / 128.633 |

prod warm total：学生 portal 157→115.2 ms（-26.6%），管理员首页 213.5→128.6 ms（-39.8%）。dev warm 数据反而变慢且抖动较大，与复用的前置 dev 进程和热更新状态有关，不据此宣称回归或收益；结构性 RTT 和 prod 数据是更可靠证据。

补充 after-only 代表路由：

| mode/path | s1 TTFB/total ms | warm avg TTFB/total ms | 备注 |
|---|---:|---:|---|
| prod `/yuanzhi/apps/korean` | 19.900 / 296.408 | 9.982 / 171.100 | 3/3 HTTP 200 |
| prod `/yuanzhi/apps/korean/progress` | 15.574 / 103.417 | 9.719 / 95.999 | 3/3 HTTP 200 |
| prod `/yuanzhi/dashboard/admin/home-tree` | 13.586 / 96.212 | 9.249 / 108.715 | 3/3 HTTP 200 |
| prod `/yuanzhi/dashboard/admin/apps/korean/content` | 15.536 / 1570.538 | 10.780 / 1502.751 | 3/3 HTTP 200；完整 load 仍主要受业务数据/客户端完成成本影响 |
| dev `/yuanzhi/apps/korean` | 184.719 / 943.438 | 170.419 / 835.430 | 3/3 HTTP 200 |
| dev `/yuanzhi/apps/korean/progress` | 189.779 / 820.242 | 227.476 / 1020.068 | 3/3 HTTP 200，波动大 |
| dev `/yuanzhi/dashboard/admin/home-tree` | 155.832 / 833.845 | N/A | s2/s3 被 dev hot reload 接管，Playwright 无 document response；不伪造 TTFB |
| dev `/yuanzhi/dashboard/admin/apps/korean/content` | N/A / 9238.165 | 183.342 / 1891.029 | s1 无 document response；s2/s3 HTTP 200 |

### 4.4 First Load JS / chunk gzip 摘要

| 路由/集合 | Phase 0 raw/gzip KiB | 本次 raw/gzip KiB | gzip 变化 |
|---|---:|---:|---:|
| 公共 root JS | 416.5 / 122.6 | 416.9 / 122.9 | +0.3 KiB |
| `/` | 428.8 / 128.3 | 429.1 / 128.6 | +0.3 KiB |
| `/[space]` | 827.4 / 244.5 | 815.3 / 240.9 | -3.6 KiB |
| Korean 首页 | 950.4 / 284.9 | 940.5 / 282.0 | -2.9 KiB |
| Korean lesson | 1262.0 / 373.9 | 1083.1 / 327.2 | **-46.7 KiB / -12.5%** |
| Korean progress | 950.4 / 284.9 | 940.5 / 282.0 | -2.9 KiB |
| admin 首页 | 960.7 / 288.8 | 951.2 / 286.1 | -2.7 KiB |
| admin app content | 1075.5 / 318.0 | 1066.5 / 315.5 | -2.5 KiB |
| admin app textbooks | 1053.7 / 314.4 | 1026.0 / 306.7 | -7.7 KiB |
| admin app toolbox | 1064.8 / 316.2 | 1034.1 / 307.5 | -8.7 KiB |
| admin home-tree | 960.7 / 288.8 | 951.2 / 286.1 | -2.7 KiB |
| `/login`（对照） | 828.5 / 242.8 | 828.8 / 243.0 | +0.2 KiB |

本次最小为 `/` 128.6 KiB gzip；最大为 legacy scoped student lesson 328.0 KiB gzip，Phase 0 最大为 374.8 KiB。以下为 Phase 0 的全部 153 条路由逐项对比。

#### 153 条同口径全表

| Route | Before raw KiB | After raw KiB | Before gzip KiB | After gzip KiB | gzip delta |
|---|---:|---:|---:|---:|---:|
| `/` | 428.8 | 429.1 | 128.3 | 128.6 | +0.3 |
| `/[space]` | 827.4 | 815.3 | 244.5 | 240.9 | -3.6 |
| `/[space]/apps/english` | 945.9 | 936.0 | 282.9 | 280.1 | -2.8 |
| `/[space]/apps/korean` | 950.4 | 940.5 | 284.9 | 282.0 | -2.9 |
| `/[space]/apps/korean/announcements` | 955.6 | 945.7 | 287.3 | 284.5 | -2.8 |
| `/[space]/apps/korean/assignments` | 979.7 | 970.3 | 294.7 | 292.0 | -2.7 |
| `/[space]/apps/korean/assignments/[assignmentId]` | 995.4 | 986.0 | 301.4 | 298.7 | -2.7 |
| `/[space]/apps/korean/assignments/korean` | 984.7 | 975.3 | 296.9 | 294.3 | -2.6 |
| `/[space]/apps/korean/assignments/korean/[testSlug]` | 1020.3 | 1010.9 | 308.8 | 306.2 | -2.6 |
| `/[space]/apps/korean/conversation-practice` | 954.1 | 944.2 | 286.7 | 283.9 | -2.8 |
| `/[space]/apps/korean/conversation-practice/[scenarioId]` | 959.0 | 949.1 | 288.4 | 285.6 | -2.8 |
| `/[space]/apps/korean/conversation-practice/ai-experience` | 955.9 | 946.1 | 287.7 | 284.9 | -2.8 |
| `/[space]/apps/korean/conversation-practice/ai-experience/practice` | 995.5 | 985.7 | 300.7 | 297.8 | -2.9 |
| `/[space]/apps/korean/conversation-practice/ai-experience/quick` | 984.7 | 974.8 | 297.3 | 294.5 | -2.8 |
| `/[space]/apps/korean/conversation-practice/course` | 954.1 | 944.2 | 286.7 | 283.9 | -2.8 |
| `/[space]/apps/korean/courses` | 973.3 | 963.9 | 293.0 | 290.4 | -2.6 |
| `/[space]/apps/korean/courses/[categorySlug]` | 978.9 | 969.5 | 295.5 | 292.9 | -2.6 |
| `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]` | 982.6 | 973.2 | 297.4 | 294.8 | -2.6 |
| `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | 985.4 | 976.0 | 298.8 | 296.2 | -2.6 |
| `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | 1262.0 | 1083.1 | 373.9 | 327.2 | -46.7 |
| `/[space]/apps/korean/grades` | 980.1 | 970.7 | 294.3 | 291.7 | -2.6 |
| `/[space]/apps/korean/help` | 971.4 | 962.0 | 292.9 | 290.3 | -2.6 |
| `/[space]/apps/korean/help/tickets/[ticketId]` | 976.3 | 966.9 | 295.3 | 292.7 | -2.6 |
| `/[space]/apps/korean/library` | 971.6 | 962.2 | 292.9 | 290.3 | -2.6 |
| `/[space]/apps/korean/practice` | 959.8 | 949.9 | 289.0 | 286.1 | -2.9 |
| `/[space]/apps/korean/practice/course` | 1021.3 | 954.8 | 305.4 | 288.1 | -17.3 |
| `/[space]/apps/korean/practice/course/[courseKey]/[chapterSlug]` | 1021.3 | 954.8 | 305.4 | 288.1 | -17.3 |
| `/[space]/apps/korean/practice/review` | 1021.3 | 954.8 | 305.4 | 288.1 | -17.3 |
| `/[space]/apps/korean/practice/skills` | 961.1 | 951.2 | 289.7 | 286.9 | -2.8 |
| `/[space]/apps/korean/practice/skills/[skill]` | 974.7 | 964.8 | 294.3 | 291.5 | -2.8 |
| `/[space]/apps/korean/practice/skills/vocabulary` | 974.7 | 964.8 | 294.3 | 291.5 | -2.8 |
| `/[space]/apps/korean/profile` | 952.6 | 945.2 | 286.0 | 284.0 | -2.0 |
| `/[space]/apps/korean/progress` | 950.4 | 940.5 | 284.9 | 282.0 | -2.9 |
| `/[space]/apps/korean/records` | 985.9 | 976.5 | 295.7 | 293.1 | -2.6 |
| `/[space]/apps/korean/toolbox` | 950.4 | 940.5 | 284.9 | 282.0 | -2.9 |
| `/[space]/apps/korean/toolbox/[skill]` | 950.4 | 940.5 | 284.9 | 282.0 | -2.9 |
| `/[space]/apps/korean/toolbox/vocabulary` | 950.4 | 940.5 | 284.9 | 282.0 | -2.9 |
| `/[space]/apps/korean/training/[skill]/[courseSlug]/[lessonSlug]/[chapterSlug]` | 965.3 | 955.4 | 290.2 | 287.4 | -2.8 |
| `/[space]/apps/math` | 945.9 | 936.0 | 282.9 | 280.1 | -2.8 |
| `/[space]/apps/study-abroad` | 945.9 | 936.0 | 282.9 | 280.1 | -2.8 |
| `/[space]/apps/study-abroad/announcements` | 949.8 | 939.9 | 284.7 | 281.8 | -2.9 |
| `/[space]/apps/study-abroad/courses` | 967.5 | 958.1 | 290.3 | 287.7 | -2.6 |
| `/[space]/apps/study-abroad/courses/[categorySlug]` | 973.1 | 963.7 | 292.9 | 290.2 | -2.7 |
| `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]` | 976.8 | 967.4 | 294.7 | 292.1 | -2.6 |
| `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | 979.6 | 970.2 | 296.1 | 293.5 | -2.6 |
| `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | 1256.2 | 1077.3 | 371.3 | 324.5 | -46.8 |
| `/[space]/apps/study-abroad/documents` | 976.6 | 967.2 | 292.5 | 289.4 | -3.1 |
| `/[space]/apps/study-abroad/help` | 965.7 | 956.3 | 290.2 | 287.6 | -2.6 |
| `/[space]/apps/study-abroad/help/tickets/[ticketId]` | 970.5 | 961.1 | 292.6 | 290.0 | -2.6 |
| `/[space]/apps/study-abroad/profile` | 946.8 | 939.4 | 283.4 | 281.3 | -2.1 |
| `/[space]/apps/study-abroad/universities` | 948.3 | 938.4 | 284.1 | 281.2 | -2.9 |
| `/[space]/apps/study-abroad/universities/comparison` | 948.3 | 938.4 | 284.1 | 281.2 | -2.9 |
| `/[space]/apps/study-abroad/universities/library` | 984.6 | 975.1 | 294.5 | 291.9 | -2.6 |
| `/[space]/apps/study-abroad/universities/library/[universityId]` | 986.5 | 977.1 | 295.3 | 292.7 | -2.6 |
| `/[space]/apps/study-abroad/universities/targets` | 956.1 | 946.3 | 287.1 | 284.3 | -2.8 |
| `/[space]/apps/study-abroad/visa` | 980.2 | 970.4 | 294.0 | 290.7 | -3.3 |
| `/[space]/apps/university` | 945.9 | 936.0 | 282.9 | 280.1 | -2.8 |
| `/[space]/dashboard` | 951.8 | 942.0 | 285.7 | 282.9 | -2.8 |
| `/[space]/dashboard/admin` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/accounts` | 1060.1 | 1051.1 | 315.7 | 313.1 | -2.6 |
| `/[space]/dashboard/admin/accounts/[profileId]` | 1072.0 | 1063.4 | 319.3 | 317.0 | -2.3 |
| `/[space]/dashboard/admin/announcements` | 1049.6 | 1040.5 | 312.6 | 310.1 | -2.5 |
| `/[space]/dashboard/admin/apps` | 962.3 | 952.7 | 289.7 | 287.0 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]` | 962.3 | 952.7 | 289.7 | 287.0 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/[section]` | 962.3 | 952.7 | 289.7 | 287.0 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/analytics` | 962.3 | 952.7 | 289.7 | 287.0 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/assessments` | 989.5 | 980.0 | 297.5 | 294.8 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/assignments/[assignmentId]` | 972.4 | 962.8 | 293.5 | 290.8 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/content` | 1075.5 | 1066.5 | 318.0 | 315.5 | -2.5 |
| `/[space]/dashboard/admin/apps/[appSlug]/conversation` | 986.2 | 976.6 | 296.6 | 293.9 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/documents` | 1047.4 | 1038.4 | 312.9 | 310.4 | -2.5 |
| `/[space]/dashboard/admin/apps/[appSlug]/grades` | 1038.0 | 1028.5 | 309.7 | 306.9 | -2.8 |
| `/[space]/dashboard/admin/apps/[appSlug]/records` | 1048.4 | 1039.3 | 313.2 | 310.7 | -2.5 |
| `/[space]/dashboard/admin/apps/[appSlug]/settings` | 968.5 | 959.0 | 291.8 | 289.1 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/students` | 962.3 | 952.7 | 289.7 | 287.0 | -2.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/textbooks` | 1053.7 | 1026.0 | 314.4 | 306.7 | -7.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/toolbox` | 1064.8 | 1034.1 | 316.2 | 307.5 | -8.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/universities` | 1069.9 | 1060.8 | 317.3 | 314.8 | -2.5 |
| `/[space]/dashboard/admin/apps/[appSlug]/visa` | 1059.3 | 1050.3 | 315.7 | 313.2 | -2.5 |
| `/[space]/dashboard/admin/assignments` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/assignments/[assignmentId]` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/assignments/chapter-tests` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/assignments/exam` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/assignments/homework` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/conversation-practice` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/conversation-practice/[scenarioId]` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/courses` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/digital-textbook` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/documents` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/documents/[studentId]` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/grades` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/grades/[itemId]` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/growth-toolbox` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/help` | 1048.1 | 1039.1 | 312.4 | 309.9 | -2.5 |
| `/[space]/dashboard/admin/help/tickets/[ticketId]` | 1057.9 | 1048.9 | 316.2 | 313.7 | -2.5 |
| `/[space]/dashboard/admin/home-tree` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/library` | 1049.1 | 1040.0 | 313.0 | 310.5 | -2.5 |
| `/[space]/dashboard/admin/my-students` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/permissions` | 1031.7 | 1022.2 | 308.0 | 305.2 | -2.8 |
| `/[space]/dashboard/admin/profile` | 969.4 | 959.9 | 291.9 | 289.1 | -2.8 |
| `/[space]/dashboard/admin/question-bank` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/records` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/schools` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/schools/[category]` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/schools/[category]/[schoolId]` | 969.1 | 960.1 | 291.7 | 289.2 | -2.5 |
| `/[space]/dashboard/admin/schools/overview` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/student-assignments` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/tenants` | 1038.4 | 1029.4 | 310.5 | 308.0 | -2.5 |
| `/[space]/dashboard/admin/tenants/[tenantId]` | 1058.2 | 1049.1 | 317.2 | 314.7 | -2.5 |
| `/[space]/dashboard/admin/tenants/history` | 1050.8 | 1041.3 | 314.4 | 311.7 | -2.7 |
| `/[space]/dashboard/admin/token-usage` | 1037.7 | 1028.6 | 310.1 | 307.6 | -2.5 |
| `/[space]/dashboard/admin/universities` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/visa` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/admin/visa/[studentId]` | 960.7 | 951.2 | 288.8 | 286.1 | -2.7 |
| `/[space]/dashboard/announcements` | 957.1 | 947.2 | 288.2 | 285.4 | -2.8 |
| `/[space]/dashboard/assignments` | 981.2 | 971.8 | 295.5 | 292.9 | -2.6 |
| `/[space]/dashboard/assignments/[assignmentId]` | 996.8 | 987.4 | 302.2 | 299.6 | -2.6 |
| `/[space]/dashboard/assignments/korean` | 986.2 | 976.8 | 297.8 | 295.1 | -2.7 |
| `/[space]/dashboard/assignments/korean/[testSlug]` | 1021.7 | 1012.3 | 309.6 | 307.0 | -2.6 |
| `/[space]/dashboard/conversation-practice` | 955.5 | 945.7 | 287.6 | 284.7 | -2.9 |
| `/[space]/dashboard/conversation-practice/[scenarioId]` | 960.4 | 950.6 | 289.3 | 286.4 | -2.9 |
| `/[space]/dashboard/conversation-practice/ai-experience` | 957.4 | 947.5 | 288.5 | 285.7 | -2.8 |
| `/[space]/dashboard/conversation-practice/ai-experience/practice` | 997.0 | 987.1 | 301.5 | 298.7 | -2.8 |
| `/[space]/dashboard/conversation-practice/ai-experience/quick` | 986.1 | 976.3 | 298.2 | 295.3 | -2.9 |
| `/[space]/dashboard/conversation-practice/course` | 955.5 | 945.7 | 287.6 | 284.7 | -2.9 |
| `/[space]/dashboard/courses` | 974.8 | 965.4 | 293.8 | 291.2 | -2.6 |
| `/[space]/dashboard/courses/[categorySlug]` | 980.4 | 971.0 | 296.4 | 293.8 | -2.6 |
| `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]` | 984.1 | 974.7 | 298.3 | 295.6 | -2.7 |
| `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | 986.9 | 977.5 | 299.7 | 297.0 | -2.7 |
| `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | 1263.4 | 1084.6 | 374.8 | 328.0 | -46.8 |
| `/[space]/dashboard/documents` | 983.8 | 974.4 | 296.0 | 292.9 | -3.1 |
| `/[space]/dashboard/grades` | 981.5 | 972.1 | 295.2 | 292.6 | -2.6 |
| `/[space]/dashboard/help` | 972.9 | 963.5 | 293.7 | 291.1 | -2.6 |
| `/[space]/dashboard/help/tickets/[ticketId]` | 977.8 | 968.4 | 296.1 | 293.5 | -2.6 |
| `/[space]/dashboard/library` | 973.1 | 963.7 | 293.8 | 291.2 | -2.6 |
| `/[space]/dashboard/live/[sessionId]` | 1200.9 | 1019.2 | 354.5 | 306.7 | -47.8 |
| `/[space]/dashboard/profile` | 954.1 | 946.6 | 286.9 | 284.8 | -2.1 |
| `/[space]/dashboard/progress` | 1013.4 | 946.8 | 302.2 | 284.9 | -17.3 |
| `/[space]/dashboard/records` | 987.4 | 978.0 | 296.5 | 293.9 | -2.6 |
| `/[space]/dashboard/settings` | 955.5 | 945.7 | 287.6 | 284.7 | -2.9 |
| `/[space]/dashboard/toolbox` | 953.1 | 943.2 | 286.4 | 283.6 | -2.8 |
| `/[space]/dashboard/toolbox/[skill]` | 966.8 | 956.9 | 291.0 | 288.2 | -2.8 |
| `/[space]/dashboard/toolbox/vocabulary` | 967.2 | 957.3 | 290.9 | 288.1 | -2.8 |
| `/[space]/dashboard/universities` | 955.5 | 945.7 | 287.6 | 284.7 | -2.9 |
| `/[space]/dashboard/universities/comparison` | 955.5 | 945.7 | 287.6 | 284.7 | -2.9 |
| `/[space]/dashboard/universities/library` | 991.8 | 982.4 | 298.0 | 295.4 | -2.6 |
| `/[space]/dashboard/universities/library/[universityId]` | 993.7 | 984.3 | 298.8 | 296.2 | -2.6 |
| `/[space]/dashboard/universities/targets` | 963.4 | 953.5 | 290.6 | 287.8 | -2.8 |
| `/[space]/dashboard/visa` | 987.5 | 977.7 | 297.6 | 294.2 | -3.4 |
| `/[space]/live/[sessionId]` | 1076.5 | 892.6 | 313.4 | 264.8 | -48.6 |
| `/dashboard` | 430.2 | 430.5 | 129.1 | 129.4 | +0.3 |
| `/dashboard/[...rest]` | 430.2 | 430.5 | 129.1 | 129.4 | +0.3 |
| `/login` | 828.5 | 828.8 | 242.8 | 243.0 | +0.2 |

## 5. 数据库迁移与安全边界

| 文件 | 作用 | 安全边界 |
|---|---|---|
| `supabase/migrations/202608170003_tenant_admin_dashboard_aggregates.sql` | tenant admin 首页 summary 与 app metrics RPC | 两个函数均 `SECURITY INVOKER`、空 `search_path`；入口显式要求 `p_tenant_id = private.current_tenant_id()` 且 `is_admin_account()`；每张业务表重复 `.tenant_id = p_tenant_id`；仅 authenticated/service_role 可执行。 |
| `supabase/migrations/202608170004_platform_management_app_overview.sql` | platform owner 跨机构 app overview 聚合初版 | `SECURITY INVOKER`；显式 `private.is_platform_owner()`；只聚合 active tenants，所有业务表逐表通过 `tenant_id` 关联，不返回学生级明细。 |
| `supabase/migrations/202608170005_platform_management_app_overview_invoker_fix.sql` | 修正 004 中 `learning_time_log` 在 invoker RLS 下不可跨租户读取的问题 | 继续 `SECURITY INVOKER`，没有改成 `SECURITY DEFINER`；仍要求 platform owner 并逐表绑定 `tenant_id`；从 RPC 契约移除 learning time，交由服务器端既有授权、tenant-correlated 的无硬截断分页兜底。 |

三份迁移都没有创建/修改 RLS policy，也没有放宽角色判定。

## 6. 明确保留、BLOCKED 与未来建议

- PERF-001：保留 middleware 与 RSC 双层身份验证。未来若要再减 1 RTT，需要可验证的短期签名上下文、撤销语义和威胁模型，不能让 RSC 盲信可伪造 header。
- PERF-002：不缓存混合用户进度、enrollment、草稿或管理范围的数据。未来可先拆纯 published catalog 的独立数据合同，再按 tenant/app tag 缓存并做 deny-path 测试。
- PERF-004/005/006：不同上限/过滤的 question 集合、current-course 五级链和课程层级合并均保留。未来优先设计 tenant-safe RPC，明确 published、解锁、tier、RLS 等价性，并用跨租户负向测试验收。
- PERF-012：`KoreanLevelOneSmartTextbook` 需状态架构重写；仅在有 bundle trace、交互测试和回退方案时单独立项。
- PERF-019：`courses→lessons` 复合 FK 的 nullable tenant_id 会让嵌套查询丢数据。未来应先修正/规范数据模型合同，再讨论合并；本轮不改 schema/RLS。
- PERF-021：`learning_time_log` 保持服务器分页兜底。未来若要并入 RPC，需先为 platform owner 建立经过安全评审的只读策略或专门聚合边界，不采用 SECURITY DEFINER 捷径。
- PERF-010/022 的真实点击交互曾在对应批次因本地 Supabase 容器缺失而 BLOCKED；本次通过远端临时账号验证 canonical 登录与页面可达，但未重新逐个点击这两个控件。静态契约、navigation tests 与 production build 均通过。

本轮完全没有触碰：权限判定结果、任何 RLS policy、真实用户/真实业务行、租户创建、Cloudflare Worker 部署、commit/push。测量只创建可识别的临时账号并在 `finally` 中清理。

## 7. 临时账号创建与清理证据

租户固定为既有 `yuanzhi`：`ead4e9d6-8b5f-4769-978b-f5a43083c491`；未新建租户。为处理 dev 表单 hydration 与 dev hot-reload 的不可用样本，共创建 4 对短生命周期账号：

| 用途 | student UUID | admin UUID | 结果 |
|---|---|---|---|
| 选择器探测重试 | `29893238-1157-4a68-9fcb-0b357afa20a1` | `4d423b95-361b-4df4-bcc7-c2ba8fe2898d` | 表单标签不匹配后立即清理 |
| dev hydration 重试 | `0643d056-6d22-4f2d-bca9-c2a145668308` | `68706454-dd3d-4b71-be87-80be7fc897f2` | dev 表单退化为 GET 后立即清理 |
| prod 完整测量 | `5077173e-6361-4ecc-90d6-8a19acdd1856` | `1d7ba7a7-3f49-4555-8d6a-9d031fb4d410` | prod 登录链与 prod 路由测量完成后清理 |
| dev canonical 测量 | `92002b85-0331-41eb-92f7-66ec1d11119d` | `344c90fe-2962-4652-9c4e-5e9d88c88a77` | 在 prod 完成真实登录、复用 localhost 会话测 dev 后清理 |

每一轮均在 `finally` 中执行同一清理与反查，最终证据：

```text
auth.admin.deleteUser(student/admin) -> error=null
auth.admin.getUserById(student/admin) -> User not found
profiles=0
tenant_memberships=0
student_app_enrollments=0
tenant_provisioned_accounts=0
staff_profiles=0
account_management_audit_logs=0
tenant_membership_audit_logs=0
```

密码、token、session cookie 均未写入本报告；失败 dev GET 中产生的敏感临时 URL 只存在于短生命周期进程输出，账号已删除。

## 8. Proof commands 与输出摘要

```bash
npm run check
# PASS: navigation 39/39; typecheck 0; lint 0

npm run build
# PASS: Next 16.2.10 webpack; compile 13.3s; TypeScript 39.2s; static 18/18; exit 0

git diff --check
# PASS: exit 0, no output

curl -sS -L -o /dev/null -w 'status=%{http_code} redirects=%{num_redirects} ttfb=%{time_starttransfer} total=%{time_total}\n' URL
# PASS: / and /login, dev/prod, 3 samples each

node --env-file=.env.local /tmp/perf-final-browser.mjs
# PASS on final dev run; prod data captured in preceding run; all accounts cleaned in finally

node /tmp/perf-final-estimate.mjs
# count=160; Phase 0 comparable routes=153; missing=0

git status --short --untracked-files=all
# final scope check; existing PERF work remains uncommitted
```

## 9. 已知限制与风险

- 本机没有可用的本地 Supabase 容器；账号与页面测量直连远端 Supabase，因此结果受网络波动和远端负载影响，不是容量测试。
- dev 使用收尾前已存在的 3000 服务，无法获得严格全新冷启动；dev hydration/hot-reload 产生不可用 document 样本，均明确标 N/A。prod build/start 数据完整。
- 未测试 Cloudflare Worker/OpenNext 部署环境；prod 指本机 `next start`。
- 动态参数业务实体没有逐条构造；运行时计时覆盖 portal、Korean 首页/进度、管理首页/home-tree/app content；静态 manifest 体积覆盖 baseline 全部 153 路由。
- gzip 是 manifest-derived estimate，不是 Next CLI 原生 First Load JS 字段，也不含 polyfill；比较有效的前提是沿用本报告与 Phase 0 的相同脚本口径。
- `content` 页面 document TTFB 很早返回流式响应，但完整 load 仍约 1.5s；后续优化应继续区分 server TTFB、RSC 数据完成和 client hydration，不应只看单一指标。
