已完成 PERF-004、PERF-005、PERF-008。未改 RLS、缓存配置、真实业务数据，未 commit/push。

### 改动文件

- [DashboardHomePage.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/DashboardHomePage.tsx:143)
  - 直接复用 `requireActiveUser()` 的 `supabase/user/profile`。
  - 删除重复 `auth.getUser()` 和 `profiles.full_name` 查询。
  - scope 后 6 个独立查询并行，派生出的 3 个查询再并行。
- [[space]/page.tsx](/home/yangzhen/projects/my-lms-system/src/app/[space]/page.tsx:139)
  - apps 与 enrollment 改为 `Promise.all`。
- [assignment layout](/home/yangzhen/projects/my-lms-system/src/app/[space]/apps/korean/assignments/[assignmentId]/layout.tsx:12)
  - 改用共享 assignment loader。
- [assignment page-content](/home/yangzhen/projects/my-lms-system/src/app/dashboard/assignments/[assignmentId]/page-content.tsx:30)
  - Korean 租户路由复用同一个 loader，保留 published 校验。
  - legacy 路由查询语义不变。
- [assignment-detail-data.ts](/home/yangzhen/projects/my-lms-system/src/lib/assignment-detail-data.ts:28)
  - 新增按 Supabase client、tenant、app、assignment ID 参数化的 request-scoped `cache()` loader。

### 验收结果

| # | 状态 | 证据 |
|---|---|---|
| 1 | PASS | `typecheck`、`lint` 均 exit 0；`test:navigation` 39/39 PASS。 |
| 2 | PASS | `npm run build` 成功；Next.js 16.2.10 webpack compile 10.8s，TypeScript 完成并生成新 `.next/BUILD_ID`。 |
| 3 | PASS | 临时 VIP3 学生真实访问 `/yuanzhi`、Korean 首页、assignment 详情均 HTTP 200。三页改前/改后正文 SHA-256 和长度完全一致，无读取错误。有效 assignment 无误报 404；随机不存在 ID 仍进入 404 UI；错误租户空间被重定向回 `yuanzhi`。 |
| 4 | PASS（含部分 BLOCKED） | PERF-004 和 PERF-008 的总 RTT 有量化下降；PERF-005 的 apps/enrollment 串行深度下降。无法安全合并部分见下。 |
| 5 | PASS | 临时账号、assignment/question 及审计记录全部清理；最终 Auth not found，所有关联表计数为 0。 |
| 6 | PASS | 本 packet 增量仅上述 5 个文件。工作树内其他大量改动在任务开始前已存在，本次未触碰；未修改 backlog、`force-dynamic` 或缓存配置。`git diff --check` 通过。 |

### RTT 对比

| 路径 | 改前 | 改后 |
|---|---:|---:|
| PERF-004 首页自身、数据齐全场景 | 最多约 14 次读取、约 14 个串行阶段 | 约 12 次读取、5 个阶段 |
| 重复 auth/profile | 2 RTT | 0 RTT |
| PERF-005 apps + enrollment | 2 RTT / 2 阶段 | 2 RTT / 1 阶段 |
| PERF-008 assignment 表读取 | 2 RTT | 1 RTT |
| PERF-008 assignment 页面首阶段总读取 | 4 RTT | 3 RTT |

Production fetch 计数器确认 assignment 详情仅出现一次 `learning_assignments`，questions/submissions 各一次。

### 明确 BLOCKED 的部分

- `StudentTopbar` 是“全部应用、最多 20 条”，Korean 首页是“Korean course IDs 范围内、最多 10 条”。共享有界结果会因截断顺序改变提醒集合；无界查询又可能造成数据量回退，因此保留两次查询。实测日志仍显示两次 `lesson_questions`。
- `getCurrentKoreanCourse` 的 root → subcategory → courses → progress → lessons 仍保留。后续 ID 均依赖前级结果，仓库没有可证明在 RLS、published 过滤和用户进度语义上完全等价的 RPC/嵌套关系。

### 临时数据清理

- 租户：`yuanzhi`，未新建租户
- 临时学生：`9d0949a5-a88f-4423-9069-ae56d6f9e1a4`
- 临时 assignment：`9fc427a5-1f6c-4bac-a005-d8038bc6102a`
- 最终：`profiles`、membership、enrollment、staff/provisioned、两类 audit、assignment 均为 `0`；Auth 为 `not-found`。