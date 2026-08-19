# Packet 10：老师班级今日任务看板（Round 4 / Packet 10）

## 背景
Round 1-3 已交付：统一任务聚合服务（`src/features/student-home-learning/api/service.ts`）、门户/韩国语首页、学生周计划（Packet 7）、老师推荐（Packet 8）、建议暂缓（Packet 9）。本 Packet 开始 Round 4，面向老师角色，做只读汇总看板，不改变任何学生数据。

方案原文（只读参考）：
- 老师查看内容：`docs/student-home-daily-learning-aggregation-roadmap.md` 第841-853行（19.1）。
- Round4 Packet10 原始任务与验收：第1052-1064行。
- 性能要求（避免逐学生循环查询）：第1144-1152行（22节）。

## 目标
新增老师端"班级今日情况"汇总能力：
1. 班级学生数、今日已学习人数、今日必做完成率、未开始人数、逾期人数、待批改人数、连续未学习学生。
2. 支持进入学生任务明细（可以是跳转到已有的学生详情页面，不需要新建完整页面，如果仓库已有老师查看单个学生的页面就复用深链；如果没有，做一个最小的只读明细视图即可，不要过度设计）。
3. **数据范围必须与教学分配一致**：老师只能看到自己负责班级/学生的数据，这是硬性红线，必须在服务端查询层强制（不是前端隐藏）。
4. **避免逐学生循环查询**：用聚合 SQL/批量查询实现，不要对每个学生单独调用 Round 1-3 的聚合服务再在应用层汇总（那样会产生 N+1 查询）。可以复用 Round 1-3 已建立的状态判定逻辑思路，但汇总统计层面要用数据库聚合查询（`GROUP BY`/`COUNT`/`FILTER` 等）直接算出人数，而不是每个学生跑一遍完整聚合服务。

## 关键要求
1. **先定位现有老师端权限判定逻辑**：仓库里应该已有"老师负责哪些班级/学生"的查询模式（参考 Packet 8 用到的 `private.current_teacher_has_student_app_access` 等函数，以及老师端现有页面如批改、成绩相关页面的权限过滤写法）。复用现有模式，不要重新发明。
2. 新增文件放在合适的 `src/features/` 目录（例如 `src/features/teacher-class-today/`），包含只读查询服务 + 展示页面/组件 + 必要的 server action（如果需要）。
3. 不要求新建一级导航入口；可以作为老师现有工作台/仪表盘下的一个页面或区块（先查看仓库里老师端现有入口结构，接入到合理位置，不要新建顶级导航）。

## 非目标 / 禁止事项
- 不允许老师读取无权限的学生数据（红线）。
- 不产生 N+1 逐学生查询（红线，需要在报告中给出证据，例如查询语句本身是聚合查询，或给出查询次数与班级学生数无关的说明）。
- 不修改学生端任何文件、不修改 Round 1-3 已交付的核心逻辑。
- 不写入/修改学生数据。

## 验收标准
1. 数据范围与教学分配一致：用真实权限判定测试证明老师查询会被限定在自己负责的班级/学生内（如果能连数据库验证就参考 Packet 7/8/9 的方式做真实验证；如果这部分是纯应用层查询过滤且已有现成 RLS 保护底层表，说明依据的 RLS 从哪来）。
2. 老师不能读取无权学生（真实测试或至少证明查询天然被现有 RLS/权限函数约束，给出证据）。
3. 汇总数字（已学习人数、完成率、未开始、逾期、待批改、连续未学习）与学生首页的判定口径一致（说明你如何保证口径一致，例如复用同一套状态映射规则）。
4. 无明显查询瀑布：给出证据（查询数量、是否用了聚合 SQL）。
5. `npm run typecheck`、`npm run lint`、`npm run build` 通过。
6. Round 1-3 已有测试全部仍然通过。
7. `git status --porcelain` 改动范围符合预期。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs tests/student-weekly-learning-plan.test.mjs tests/teacher-learning-recommendation.test.mjs tests/student-learning-task-preferences.test.mjs`
- 为新增的汇总查询逻辑编写 fixture 单元测试（覆盖：正确统计各类人数、老师权限范围过滤生效）
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。

## 交付报告格式
1. 改动/新增文件列表（含引用的现有权限判定逻辑源文件+行号）。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出。
4. 权限隔离和"无查询瀑布"的具体证据。
5. 已知假设、遗留问题或范围偏差说明。
