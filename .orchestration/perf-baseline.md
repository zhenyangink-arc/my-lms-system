# Dev vs Prod 性能基线（桌面端）

日期：2026-08-17（Asia/Seoul）  
栈：Next.js 16.2.10、webpack、Supabase SSR、`@opennextjs/cloudflare`  
目标：只读诊断；未修改 `src/`、RLS、租户或真实用户数据。

## 1. 口径与环境

- Playwright Chromium 1440×900，headless；本机直连远程 Supabase。
- 未登录：`curl -sS -L -o /dev/null -w ...`，每项 3 次；s1 为冷/首个样本，warm average 为 s2+s3。
- 登录态：真实 `/login` + `signInWithPassword` 后保存同一会话，最终 canonical 页面整页刷新 3 次。`TTFB` 来自 request timing，`total` 为 document load 完成时间。
- dev 为 `next dev --webpack`；prod 为 `next build --webpack && next start`。dev s1 含按路由编译，不能与 prod s1 等价解释。
- 结果包含当时网络波动，不是容量测试。

## 2. 未登录 curl 基线

所有样本最终 HTTP 200、`redirects=0`。`/` 的源码 `redirect('/login')` 在构建期成为客户端重定向壳，curl 未观察到 HTTP 3xx，故按 wire 行为记录。

| mode | path | s1 TTFB / total (ms) | s2 (ms) | s3 (ms) | warm avg TTFB / total (ms) |
|---|---:|---:|---:|---:|---:|
| dev | `/` | 115.711 / 116.628 | 31.200 / 32.134 | 29.608 / 30.533 | 30.404 / 31.334 |
| dev | `/login` | 190.543 / 191.545 | 40.442 / 41.558 | 39.532 / 40.608 | 39.987 / 41.083 |
| prod | `/` | 74.073 / 74.105 | 3.844 / 3.870 | 2.985 / 3.008 | 3.415 / 3.439 |
| prod | `/login` | 6.984 / 7.009 | 3.073 / 3.096 | 2.641 / 2.662 | 2.857 / 2.879 |

```text
dev /      s1 status=200 redirects=0 ttfb=0.115711 total=0.116628
dev /      s2 status=200 redirects=0 ttfb=0.031200 total=0.032134
dev /      s3 status=200 redirects=0 ttfb=0.029608 total=0.030533
dev /login s1 status=200 redirects=0 ttfb=0.190543 total=0.191545
dev /login s2 status=200 redirects=0 ttfb=0.040442 total=0.041558
dev /login s3 status=200 redirects=0 ttfb=0.039532 total=0.040608
prod /      s1 status=200 redirects=0 ttfb=0.074073 total=0.074105
prod /      s2 status=200 redirects=0 ttfb=0.003844 total=0.003870
prod /      s3 status=200 redirects=0 ttfb=0.002985 total=0.003008
prod /login s1 status=200 redirects=0 ttfb=0.006984 total=0.007009
prod /login s2 status=200 redirects=0 ttfb=0.003073 total=0.003096
prod /login s3 status=200 redirects=0 ttfb=0.002641 total=0.002662
```

## 3. 真实登录链与登录态刷新

Playwright 对 App Router 的 RSC `redirect()` 可记录为 200 document/RSC 导航；下列跳数按 URL 状态迁移，而不只数 3xx。

| mode | role | 观察到的链 | 状态 | 提交至落地稳定 |
|---|---|---|---:|---:|
| prod | student | `/login` → Supabase `/auth/v1/token` → `/login/redirect` → `/yuanzhi` | PASS | 3278 ms |
| prod | admin | `/login` → token → `/login/redirect` → `/dashboard` → `/yuanzhi/dashboard` → `/yuanzhi/dashboard/admin` | PASS | 2292 ms |
| dev | admin | `/login` → `/login/redirect` → `/dashboard`（随后 canonical 编译） | PASS（部分链） | 4459 ms 至 `/dashboard` |
| dev | student | dev manifest 截断导致 hydration 失败 | FAIL（作废样本） | N/A |

管理员 prod 多出的迁移来自：登录角色先落 legacy `/dashboard`、tenant canonical 化、管理角色首页跳转。学生由 `/login/redirect` 直接进入租户门户。

| mode | role/path | s1 TTFB / total (ms) | s2 | s3 | warm avg TTFB / total |
|---|---|---:|---:|---:|---:|
| dev | student `/yuanzhi` | 7472 / 8592 | 191 / 859 | 67 / 723 | 129 / 791 |
| prod | student `/yuanzhi` | 12 / 263 | 9 / 159 | 8 / 155 | 8.5 / 157 |
| dev | admin `/yuanzhi/dashboard/admin` | 2283 / 3223 | 86 / 810 | 89 / 815 | 87.5 / 812.5 |
| prod | admin `/yuanzhi/dashboard/admin` | 11 / 186 | 9 / 218 | 11 / 209 | 10 / 213.5 |

登录态 TTFB 很早收到流式响应，`total` 更接近完整文档/客户端资源成本。客户端 `<Link>` 会复用未失效共享 layout，不能把整页刷新成本等同于每次同-app软导航；legacy `/dashboard/**` 中转会离开 canonical layout 树，确定增加请求/鉴权链。

## 4. Build 证据

```text
npm run build
test:navigation: 32/32 PASS
Next.js 16.2.10 (webpack)
optimized production compile: 12.3s
TypeScript: 38.0s
static pages: 18/18 in 431ms
exit code: 0
```

`/`、`/login` 为 `○` prerendered；`/dashboard*` 与全部 `[space]` 页面为 `ƒ` dynamic；Proxy (Middleware) 启用。

### 4.1 First Load JS 口径

Next 16.2.10 CLI 不再打印旧版逐路由 First Load JS。以下固定可复现估算：读取 `.next/build-manifest.json` 的 `rootMainFiles`；对每个目标 page 执行对应 `page_client-reference-manifest.js`；合并公共入口与 `clientModules[*].chunks` 的 JS 并去重；累计 raw bytes 与逐文件 `gzipSync` bytes。

153 条目标 page 全部成功，`missing=0`。gzip 最接近旧 CLI First Load JS，但属于 manifest-derived estimate，不含 polyfill，不能当作 CLI 原生字段。公共 root JS 为 416.5 KiB raw / 122.6 KiB gzip；含 Supabase 的显著公共 chunk为 181.0 / 50.7 KiB。最小 `/` 128.3 KiB gzip；最大 lesson 374.8 KiB gzip。

| Route | Raw KiB | Gzip KiB |
|---|---:|---:|
| `/` | 428.8 | 128.3 |
| `/[space]` | 827.4 | 244.5 |
| `/[space]/apps/english` | 945.9 | 282.9 |
| `/[space]/apps/korean` | 950.4 | 284.9 |
| `/[space]/apps/korean/announcements` | 955.6 | 287.3 |
| `/[space]/apps/korean/assignments` | 979.7 | 294.7 |
| `/[space]/apps/korean/assignments/[assignmentId]` | 995.4 | 301.4 |
| `/[space]/apps/korean/assignments/korean` | 984.7 | 296.9 |
| `/[space]/apps/korean/assignments/korean/[testSlug]` | 1020.3 | 308.8 |
| `/[space]/apps/korean/conversation-practice` | 954.1 | 286.7 |
| `/[space]/apps/korean/conversation-practice/[scenarioId]` | 959.0 | 288.4 |
| `/[space]/apps/korean/conversation-practice/ai-experience` | 955.9 | 287.7 |
| `/[space]/apps/korean/conversation-practice/ai-experience/practice` | 995.5 | 300.7 |
| `/[space]/apps/korean/conversation-practice/ai-experience/quick` | 984.7 | 297.3 |
| `/[space]/apps/korean/conversation-practice/course` | 954.1 | 286.7 |
| `/[space]/apps/korean/courses` | 973.3 | 293.0 |
| `/[space]/apps/korean/courses/[categorySlug]` | 978.9 | 295.5 |
| `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]` | 982.6 | 297.4 |
| `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | 985.4 | 298.8 |
| `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | 1262.0 | 373.9 |
| `/[space]/apps/korean/grades` | 980.1 | 294.3 |
| `/[space]/apps/korean/help` | 971.4 | 292.9 |
| `/[space]/apps/korean/help/tickets/[ticketId]` | 976.3 | 295.3 |
| `/[space]/apps/korean/library` | 971.6 | 292.9 |
| `/[space]/apps/korean/practice` | 959.8 | 289.0 |
| `/[space]/apps/korean/practice/course` | 1021.3 | 305.4 |
| `/[space]/apps/korean/practice/course/[courseKey]/[chapterSlug]` | 1021.3 | 305.4 |
| `/[space]/apps/korean/practice/review` | 1021.3 | 305.4 |
| `/[space]/apps/korean/practice/skills` | 961.1 | 289.7 |
| `/[space]/apps/korean/practice/skills/[skill]` | 974.7 | 294.3 |
| `/[space]/apps/korean/practice/skills/vocabulary` | 974.7 | 294.3 |
| `/[space]/apps/korean/profile` | 952.6 | 286.0 |
| `/[space]/apps/korean/progress` | 950.4 | 284.9 |
| `/[space]/apps/korean/records` | 985.9 | 295.7 |
| `/[space]/apps/korean/toolbox` | 950.4 | 284.9 |
| `/[space]/apps/korean/toolbox/[skill]` | 950.4 | 284.9 |
| `/[space]/apps/korean/toolbox/vocabulary` | 950.4 | 284.9 |
| `/[space]/apps/korean/training/[skill]/[courseSlug]/[lessonSlug]/[chapterSlug]` | 965.3 | 290.2 |
| `/[space]/apps/math` | 945.9 | 282.9 |
| `/[space]/apps/study-abroad` | 945.9 | 282.9 |
| `/[space]/apps/study-abroad/announcements` | 949.8 | 284.7 |
| `/[space]/apps/study-abroad/courses` | 967.5 | 290.3 |
| `/[space]/apps/study-abroad/courses/[categorySlug]` | 973.1 | 292.9 |
| `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]` | 976.8 | 294.7 |
| `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | 979.6 | 296.1 |
| `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | 1256.2 | 371.3 |
| `/[space]/apps/study-abroad/documents` | 976.6 | 292.5 |
| `/[space]/apps/study-abroad/help` | 965.7 | 290.2 |
| `/[space]/apps/study-abroad/help/tickets/[ticketId]` | 970.5 | 292.6 |
| `/[space]/apps/study-abroad/profile` | 946.8 | 283.4 |
| `/[space]/apps/study-abroad/universities` | 948.3 | 284.1 |
| `/[space]/apps/study-abroad/universities/comparison` | 948.3 | 284.1 |
| `/[space]/apps/study-abroad/universities/library` | 984.6 | 294.5 |
| `/[space]/apps/study-abroad/universities/library/[universityId]` | 986.5 | 295.3 |
| `/[space]/apps/study-abroad/universities/targets` | 956.1 | 287.1 |
| `/[space]/apps/study-abroad/visa` | 980.2 | 294.0 |
| `/[space]/apps/university` | 945.9 | 282.9 |
| `/[space]/dashboard` | 951.8 | 285.7 |
| `/[space]/dashboard/admin` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/accounts` | 1060.1 | 315.7 |
| `/[space]/dashboard/admin/accounts/[profileId]` | 1072.0 | 319.3 |
| `/[space]/dashboard/admin/announcements` | 1049.6 | 312.6 |
| `/[space]/dashboard/admin/apps` | 962.3 | 289.7 |
| `/[space]/dashboard/admin/apps/[appSlug]` | 962.3 | 289.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/[section]` | 962.3 | 289.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/analytics` | 962.3 | 289.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/assessments` | 989.5 | 297.5 |
| `/[space]/dashboard/admin/apps/[appSlug]/assignments/[assignmentId]` | 972.4 | 293.5 |
| `/[space]/dashboard/admin/apps/[appSlug]/content` | 1075.5 | 318.0 |
| `/[space]/dashboard/admin/apps/[appSlug]/conversation` | 986.2 | 296.6 |
| `/[space]/dashboard/admin/apps/[appSlug]/documents` | 1047.4 | 312.9 |
| `/[space]/dashboard/admin/apps/[appSlug]/grades` | 1038.0 | 309.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/records` | 1048.4 | 313.2 |
| `/[space]/dashboard/admin/apps/[appSlug]/settings` | 968.5 | 291.8 |
| `/[space]/dashboard/admin/apps/[appSlug]/students` | 962.3 | 289.7 |
| `/[space]/dashboard/admin/apps/[appSlug]/textbooks` | 1053.7 | 314.4 |
| `/[space]/dashboard/admin/apps/[appSlug]/toolbox` | 1064.8 | 316.2 |
| `/[space]/dashboard/admin/apps/[appSlug]/universities` | 1069.9 | 317.3 |
| `/[space]/dashboard/admin/apps/[appSlug]/visa` | 1059.3 | 315.7 |
| `/[space]/dashboard/admin/assignments` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/assignments/[assignmentId]` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/assignments/chapter-tests` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/assignments/exam` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/assignments/homework` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/conversation-practice` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/conversation-practice/[scenarioId]` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/courses` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/digital-textbook` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/documents` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/documents/[studentId]` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/grades` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/grades/[itemId]` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/growth-toolbox` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/help` | 1048.1 | 312.4 |
| `/[space]/dashboard/admin/help/tickets/[ticketId]` | 1057.9 | 316.2 |
| `/[space]/dashboard/admin/home-tree` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/library` | 1049.1 | 313.0 |
| `/[space]/dashboard/admin/my-students` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/permissions` | 1031.7 | 308.0 |
| `/[space]/dashboard/admin/profile` | 969.4 | 291.9 |
| `/[space]/dashboard/admin/question-bank` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/records` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/schools` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/schools/[category]` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/schools/[category]/[schoolId]` | 969.1 | 291.7 |
| `/[space]/dashboard/admin/schools/overview` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/student-assignments` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/tenants` | 1038.4 | 310.5 |
| `/[space]/dashboard/admin/tenants/[tenantId]` | 1058.2 | 317.2 |
| `/[space]/dashboard/admin/tenants/history` | 1050.8 | 314.4 |
| `/[space]/dashboard/admin/token-usage` | 1037.7 | 310.1 |
| `/[space]/dashboard/admin/universities` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/visa` | 960.7 | 288.8 |
| `/[space]/dashboard/admin/visa/[studentId]` | 960.7 | 288.8 |
| `/[space]/dashboard/announcements` | 957.1 | 288.2 |
| `/[space]/dashboard/assignments` | 981.2 | 295.5 |
| `/[space]/dashboard/assignments/[assignmentId]` | 996.8 | 302.2 |
| `/[space]/dashboard/assignments/korean` | 986.2 | 297.8 |
| `/[space]/dashboard/assignments/korean/[testSlug]` | 1021.7 | 309.6 |
| `/[space]/dashboard/conversation-practice` | 955.5 | 287.6 |
| `/[space]/dashboard/conversation-practice/[scenarioId]` | 960.4 | 289.3 |
| `/[space]/dashboard/conversation-practice/ai-experience` | 957.4 | 288.5 |
| `/[space]/dashboard/conversation-practice/ai-experience/practice` | 997.0 | 301.5 |
| `/[space]/dashboard/conversation-practice/ai-experience/quick` | 986.1 | 298.2 |
| `/[space]/dashboard/conversation-practice/course` | 955.5 | 287.6 |
| `/[space]/dashboard/courses` | 974.8 | 293.8 |
| `/[space]/dashboard/courses/[categorySlug]` | 980.4 | 296.4 |
| `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]` | 984.1 | 298.3 |
| `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | 986.9 | 299.7 |
| `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | 1263.4 | 374.8 |
| `/[space]/dashboard/documents` | 983.8 | 296.0 |
| `/[space]/dashboard/grades` | 981.5 | 295.2 |
| `/[space]/dashboard/help` | 972.9 | 293.7 |
| `/[space]/dashboard/help/tickets/[ticketId]` | 977.8 | 296.1 |
| `/[space]/dashboard/library` | 973.1 | 293.8 |
| `/[space]/dashboard/live/[sessionId]` | 1200.9 | 354.5 |
| `/[space]/dashboard/profile` | 954.1 | 286.9 |
| `/[space]/dashboard/progress` | 1013.4 | 302.2 |
| `/[space]/dashboard/records` | 987.4 | 296.5 |
| `/[space]/dashboard/settings` | 955.5 | 287.6 |
| `/[space]/dashboard/toolbox` | 953.1 | 286.4 |
| `/[space]/dashboard/toolbox/[skill]` | 966.8 | 291.0 |
| `/[space]/dashboard/toolbox/vocabulary` | 967.2 | 290.9 |
| `/[space]/dashboard/universities` | 955.5 | 287.6 |
| `/[space]/dashboard/universities/comparison` | 955.5 | 287.6 |
| `/[space]/dashboard/universities/library` | 991.8 | 298.0 |
| `/[space]/dashboard/universities/library/[universityId]` | 993.7 | 298.8 |
| `/[space]/dashboard/universities/targets` | 963.4 | 290.6 |
| `/[space]/dashboard/visa` | 987.5 | 297.6 |
| `/[space]/live/[sessionId]` | 1076.5 | 313.4 |
| `/dashboard` | 430.2 | 129.1 |
| `/dashboard/[...rest]` | 430.2 | 129.1 |
| `/login` | 828.5 | 242.8 |

## 5. 临时账号与清理证据

挂靠已有租户 `yuanzhi`（`ead4e9d6-8b5f-4769-978b-f5a43083c491`）；未新建租户，未读取或修改真实用户内容。

| role | auth user / profile id | 创建行 | 测量用途 | 清理 |
|---|---|---|---|---|
| student | `16b2d582-b21f-4354-9063-d5a0e5896b6c` | auth user；profile student/member；membership student/default；audit 422 | prod 真登录；dev/prod `/yuanzhi` | auth not found；关联计数 0 |
| admin | `d1097766-49d1-4b8e-ab82-fbaab47c210a` | auth user；profile tenant_super_admin；membership tenant_super_admin/default；audit 423 | dev/prod 真登录；admin 落地/刷新 | auth not found；关联计数 0 |

删除 auth user 后 FK cascade 删除 profile/membership，并产生 delete audit 424、425；随后定点删除 audit 422–425。

```text
profiles=0
tenant_memberships=0
tenant_provisioned_accounts=0
staff_profiles=0
tenant_membership_audit_logs=0
auth.admin.getUserById(student) -> User not found
auth.admin.getUserById(admin)   -> User not found
```

测量 session、浏览器状态及含登录信息的 dev 临时日志已删除，不可恢复；报告不保存密码/token。

## 6. Proof commands（摘要）

```bash
npm run build
npm run dev -- -p 3100
npm start -- -p 3101
curl -sS -L -o /dev/null -w 'status=%{http_code} redirects=%{num_redirects} ttfb=%{time_starttransfer} total=%{time_total}\n' URL
node <Playwright desktop login/reload harness>
DOTENV_CONFIG_PATH=.env.local node -r dotenv/config <Supabase admin create/query/delete harness>
node <build-manifest + client-reference-manifest gzip estimator>
git status --short --branch
```

账号 API 等价操作：`auth.admin.createUser`；`profiles.update`；`tenant_memberships.insert`；测量后 `auth.admin.deleteUser`，再按 `target_user_id` 删除 audit；最后逐表 count 与 `getUserById` 归零核验。密码、service role key、session cookie 未写入报告。

## 7. 验收状态

| # | 状态 | 证据 |
|---|---|---|
| 1 | PASS | 两份报告已生成；本文件含计时、153 路由 JS、账号和 proof；backlog 含覆盖矩阵与条目。 |
| 2 | FAIL（前置状态） | 本任务只写两份报告且无 `src/` diff；但任务开始前已有未跟踪 `.orchestration/perf-governance-state.md`，不能删除用户文件，因此全仓 status 不可能只显示两份报告。 |
| 3 | PASS | 两账号已创建并真实使用；UUID/行见上；auth 与 5 类关联/审计计数最终为 0。 |
| 4 | PASS | backlog 覆盖学生/管理主要 app/分组，并明确“已检查，无发现”。 |

## 8. Caveats

- dev 学生 UI 登录因 Next dev manifest `Unexpected end of JSON`/hydration 失败作废；账号仍通过 prod 真实 UI 登录并用于 dev canonical 页面测量。故障只在 `.next/dev` 生成物，不涉及 `src/`。
- 动态参数页未逐个构造业务实体；First Load 覆盖全部 page，运行时只触达门户与管理首页。需特定 assignment/course/ticket ID 的路径以静态查询链覆盖。
- 未测 Cloudflare Worker；这是本机 `next start` 基线。
- 后续比较必须复用同一 manifest 估算脚本与 Next 版本。
