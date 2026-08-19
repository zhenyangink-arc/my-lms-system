# Packet 5：韩国语应用首页任务区（Round 2 / Packet 5）

## 背景
Packet 4 已交付 `src/features/student-home-learning/api/service.ts`：并行聚合5类来源（作业考试/课程/章节巩固/专项训练/错题）、去重、排序，并提供门户摘要选择函数。本 Packet 复用同一个 `service.ts` 的完整任务列表（不是门户摘要函数），在韩国语应用首页展示完整"今日学习"任务区。

Packet 0 侦察结论：`/{space}/apps/korean` 路由文件只是一行重导出，实际实现在 `src/app/dashboard/DashboardHomePage.tsx`，改造时必须以这个真实实现文件为准，不能只改一行重导出文件。

方案原文（只读参考）：
- 韩国语应用首页结构：`docs/student-home-daily-learning-aggregation-roadmap.md` 第162-200行（5.2）。
- 详细模块要求：第606-687行（13节，13.1今天最重要/13.2今日必做/13.3继续学习/13.4今日建议/13.7现有入口）。
- 交互与视觉要求：第689-703行（14节）。

本 Packet **不包含**"本周学习计划"（13.5）和"最近成绩与反馈"（13.6）——那两块依赖 Round 3 的学生周计划表和更细的成绩展示，暂不实现，只需在验收报告中确认没有强行塞入占位假数据。

## 目标
修改 `src/app/dashboard/DashboardHomePage.tsx`（韩国语应用首页真实实现），加入：

1. **今天最重要**：只显示一个主任务，含标题、来源、截止时间或进度、推荐原因、唯一主要按钮（13.1）。
2. **今日必须完成**：任务卡列表，含标题、类型（作业/考试/补考/老师必做推荐——第一版没有老师推荐可跳过该分支）、开始或截止时间、当前状态、必做原因、主要操作，按紧急程度排序（13.2）。
3. **继续上次学习**：只突出一个首要继续任务，含课程/课时/章节、当前进度、上次学习时间、继续按钮；其他课程仍走现有课程入口，不在首页堆叠多张大卡片（13.3）。
4. **今日建议**：最多3条系统建议（非必做的 course/chapter_practice/specialized_practice/review 任务），含建议内容、原因、开始按钮（13.4）。本 Packet 不需要实现"暂缓建议"交互（那是 Round 3 Packet 9 的范围），按钮只需要能跳转。
5. 保留现有课程学习/作业考试/巩固中心/专项训练/错题复习入口，作为次级导航，不与"今天最重要"抢主操作位（13.7）。

## 交互与视觉要求（必须遵守）
- 每个区域只有一个主要操作。
- 任务卡可整卡点击，但不能出现嵌套冲突链接（`<a>`套`<a>`之类）。
- 核心触控区域至少44px。
- 状态用图标+文字，不能只靠颜色区分。
- 无任务时提供"继续课程"或"进入巩固中心"的引导，不是空白或报错。
- 不新增 `/today` 页面，不新增一级导航。
- 首页只有一个"首要任务"（不能有两个模块都自称最重要）。
- 遵守本项目 CLAUDE.md 硬性规则：不使用纯装饰性英文眉题/类型标签；标题+补充说明必须复用 `@/components/ui/card-title-with-hint`，不要自建叹号按钮或 Tooltip。

## 非目标 / 禁止事项
- 不新增路由、不新增一级导航。
- 不修改 `src/app/[space]/page.tsx`（Packet 4 范围）或 `service.ts` 内部聚合逻辑（如需要新增便捷函数可以新增，不要破坏已有导出签名）。
- 不实现"本周学习计划"和"最近成绩与反馈"两块（Round 3 范围）。
- 不实现建议暂缓交互（Round 3 Packet 9 范围）。
- 不写数据库。

## 验收标准
1. 不新增 `/today` 页面或路由。
2. 首页只有一个首要任务（"今天最重要"模块）。
3. "今日必须完成"任务按紧急程度排序（复用 `service.ts`/`priority.ts` 的排序结果，不要在组件里重新发明排序）。
4. "继续上次学习"只展示一个首要任务，链接进入 Packet 1 深链构造的真实"最后有效位置"。
5. "今日建议"最多3条，非必做任务。
6. 不重复现有业务操作界面（不是把作业列表整个搬进首页）。
7. 现有课程/作业/巩固/训练/错题入口仍然存在。
8. 无任务时页面结构正常，有合理引导，不报错。
9. 标题补充说明复用 `card-title-with-hint`。
10. `npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:navigation` 全部通过。
11. Round 1/2 已有测试仍然全部通过。
12. `git status --porcelain` 显示改动范围符合预期（`DashboardHomePage.tsx` 被修改，可能新增少量展示组件文件，不应出现对 Round 1/2 已交付文件的破坏性重写）。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs`
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。不要放宽断言、不要跳过用例。

## 交付报告格式
1. 改动/新增文件列表。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出。
4. 已知假设、遗留问题或范围偏差说明。
