# Packet 9：建议暂缓与恢复（Round 3 / Packet 9）

## 背景
Packet 7 交付了学生周计划表，Packet 8 交付了老师推荐表，两者都用真实临时数据库验证了 RLS/约束。本 Packet 延续同样的验证深度，是 Round 3 最后一个任务，完成后进入 Round 4（老师/机构数据看板和响应式收尾）。

方案原文（只读参考）：
- 表结构建议：`docs/student-home-daily-learning-aggregation-roadmap.md` 第806-820行（17.3）。
- 学生权限边界：第239-256行（6.4，可以暂缓普通系统建议，不能暂缓老师必做/截止提醒）。
- 暂缓交互细节：第547-559行（11.3）。

## 目标
1. **新增迁移**：建表 `student_learning_task_preferences`，字段参考路线图第808-818行：
   `tenant_id`、`student_id`、`student_app_id`、`task_key`、`snoozed_until`、`dismissed_for_week`、`updated_at`。
   - `task_key` 格式沿用 Packet 1 定义的 `studentAppId:sourceType:sourceId`。
   - **该表只控制展示，不改变来源任务状态**（路线图第820行明确要求，这是设计红线：这张表绝不能被拿来当作"完成状态"的另一份真相）。
   - **RLS 硬性要求**：学生只能读写自己的偏好记录；机构间隔离；参考 Packet 7/8 已经建立的角色判定函数风格。
2. **暂缓语义**：
   - 今天稍后提醒 / 明天提醒 / 本周不再提示 三种选项（对应写入不同的 `snoozed_until` 或 `dismissed_for_week`）。
   - 提供恢复入口（清除暂缓状态）。
   - **禁止暂缓老师必做任务和作业/考试截止提醒**（`required: true` 的任务）——这个限制必须在服务端强制校验，不能只在前端隐藏按钮。用真实的 INSERT/UPDATE 测试证明"尝试暂缓一个必做任务的 task_key"会被拒绝或被服务端逻辑忽略（选择在 RLS/CHECK 约束层拦截，或在 Server Action 层查询任务的 `required` 状态后拒绝——如果选择后者，说明为什么这样比数据库层拦截更合适）。
3. **接入聚合服务**：修改 `src/features/student-home-learning/api/service.ts`（Packet 4 交付），在返回任务列表前，根据学生的暂缓偏好过滤掉已暂缓且未到期的**非必做**任务；必做任务永远不受暂缓状态影响。这是本 Packet 唯一允许触碰 Round 1/2 核心逻辑文件的地方，只能新增一个过滤步骤，不能改动已有的聚合、去重、排序逻辑本身。
4. **Server Action**：暂缓/恢复建议的写操作。

## 非目标 / 禁止事项
- 不允许暂缓必做任务或截止提醒生效（这是硬性红线）。
- 不允许没有 RLS 的表上线。
- 不能修改来源业务表的任何状态（作业、考试、课程进度等）。
- 不要求本 Packet 实现暂缓交互的 UI 组件（如果顺手可以加一个最小的暂缓/恢复按钮到 Packet 5 的"今日建议"区块，做不完必须说明，不能让其他验收项 FAIL）。

## 验收标准
1. 迁移真实应用到 PostgreSQL 数据库并验证 RLS（延续 Packet 7/8 的验证方式：临时数据库 + `psql -v ON_ERROR_STOP=1` + 查询 `pg_policies`/`relrowsecurity`/权限视图）。
2. 用真实测试证明：尝试暂缓一个 `required: true` 任务的 `task_key` 会被拒绝（贴出实际报错或拒绝证据）。
3. 暂缓到期后（`snoozed_until` 已过或跨周）任务重新出现在聚合结果中——用单元测试证明（fixture 数据，不依赖真实数据库）。
4. 必做任务永远不受暂缓影响——用单元测试证明。
5. 暂缓记录只能由本人管理，跨学生读写会被拒绝（真实数据库验证）。
6. `service.ts` 改动是纯新增过滤步骤，Round 1/2 已有测试（15个）仍然全部通过，没有被修改或删除。
7. `npm run typecheck`、`npm run lint`、`npm run build` 通过。
8. `git status --porcelain` 改动范围符合预期。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs tests/student-weekly-learning-plan.test.mjs tests/teacher-learning-recommendation.test.mjs`（确认这4个既有测试文件全部仍然通过，不能有一个变红）
- 新增暂缓功能的 fixture 单元测试（暂缓生效/到期恢复/必做任务不受影响）
- 迁移的真实数据库验证，包含至少一条"尝试暂缓必做任务"被拒绝的实测证据
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。**"必做任务不可暂缓"和"RLS 隔离"都是硬性红线，必须有真实证据，不能只描述设计意图。**

## 交付报告格式
1. 改动/新增文件列表。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出（包括拒绝暂缓必做任务的实际报错/拒绝证据）。
4. RLS 策略摘要。
5. 已知假设、遗留问题或范围偏差说明（尤其是"必做校验放在哪一层"的设计取舍理由）。
