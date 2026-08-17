已完成三项代码清理；静态检查、导航测试和生产构建均通过。由于本地 Supabase 未运行，无法完成临时账号浏览器实测，相关验收如实标为 BLOCKED。

### 改动文件

PERF-010：

- [KoreanLevelOneBookTemplate.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneBookTemplate.tsx:35)
- `KoreanLevelOneLessonBook.tsx`
- `KoreanLevelOneLessonTwoBook.tsx` 至 `KoreanLevelOneLessonElevenBook.tsx`，共 11 个 lesson book 文件

共享按钮现在使用 `router.push()`，并通过 `scopeDashboardPath()` 根据当前 workspace 生成路径。

PERF-022：

- [DataSyncStatusDialog.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/DataSyncStatusDialog.tsx:65)

Lint 清理：

- [courses/api/service.ts](/home/yangzhen/projects/my-lms-system/src/features/courses/api/service.ts:88)
- [digital-textbook/api/service.ts](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/api/service.ts:183)
- [growth-toolbox/api/service.ts](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/api/service.ts:161)

### 验收结果

1. **PASS** — typecheck、lint、navigation tests

   - `npm run typecheck`：exit 0
   - `npm run lint`：exit 0，0 warnings
   - 10 个下划线占位绑定全部清零
   - `npm run test:navigation`：39 passed，0 failed

2. **PASS** — production build

   - `npm run build`：exit 0
   - Next.js 16.2.10 编译、TypeScript、静态页面生成全部成功
   - 构建路由包含 `/{space}/apps/korean/assignments/korean`

3. **BLOCKED** — 临时学生账号浏览器实测

   静态证据：

   - 11 个 `window.location.assign()` 均已移除。
   - 使用 `router.push(href)`，不会主动整页刷新。
   - 路径 helper 验证：
     - `/acme/apps/korean` → `/acme/apps/korean/assignments/korean`
     - `/acme/dashboard` → `/acme/dashboard/assignments/korean`
     - `/dashboard` → `/dashboard/assignments/korean`

   阻塞原因：`supabase status` 报告本地数据库容器 `supabase_db_my-lms-system` 不存在。

4. **BLOCKED** — 临时管理员账号浏览器实测

   静态证据：按钮已改为 `router.refresh()`，目标文件中不存在 `window.location.reload()`。同样因本地认证环境不可用而无法完成账号点击实测。

5. **BLOCKED** — 临时账号创建/清理记录

   未创建任何临时账号，也未修改真实数据，因此没有待清理账号。为遵守“不动真实数据”，未转向远端环境创建账号。

6. **BLOCKED** — 全工作树范围

   本次目标文件共 16 个，均属于 packet 描述范围。但共享工作树在任务开始前已有大量其他批次修改和未跟踪文件，因此完整 `git status --short` 不可能只显示本 packet 文件。本次未回退、提交或推送任何既有修改。`git diff --check` 通过。

### 未使用变量核查

10 个变量都不是漏用数据，而是 object-rest 解构中用于排除 Supabase 嵌套关系字段的占位绑定。现在改为在浅拷贝上使用 `Reflect.deleteProperty()` 排除相同字段，保持原返回数据形状，没有补入或改变业务字段。